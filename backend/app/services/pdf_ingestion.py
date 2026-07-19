"""Bounded PDF upload, immutable storage, and page-level source ingestion."""

from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Annotated

import pymupdf
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.contracts.source import SourceUnit
from app.persistence.documents import BookDoc, construct_document, utc_now
from app.persistence.protocols import (
    BookRepository,
    PdfIngestionDispatcher,
    SourceUnitRepository,
)

from .errors import InvalidPdfError, NotFoundError, PdfLimitError
from .source_units import ParsedPage, normalize_pages, source_unit_contract

DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


class BookView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    book_id: str
    owner_id: str
    title: str
    author: str | None
    original_filename: str
    pdf_hash: str
    status: str
    total_pages: Annotated[int, Field(ge=0)]
    parse_version: str | None
    error_code: str | None
    error_detail: str | None
    created_at: AwareDatetime
    updated_at: AwareDatetime


class UploadResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    book: BookView
    task_id: str | None = None
    is_cached: bool


class ParsedPdf(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None
    author: str | None
    total_pages: int
    pages: list[ParsedPage]


class PdfParser:
    parse_version = "pymupdf-page-text.v1"

    def __init__(self, *, max_pages: int = 2_000) -> None:
        self._max_pages = max_pages

    def parse(self, path: Path) -> ParsedPdf:
        try:
            document = pymupdf.open(path)
        except (pymupdf.FileDataError, RuntimeError, ValueError) as error:
            raise InvalidPdfError("PDF bytes are malformed or unsupported") from error

        try:
            if document.needs_pass:
                raise InvalidPdfError("Encrypted PDFs are not supported")
            if document.page_count < 1:
                raise InvalidPdfError("PDF has no pages")
            if document.page_count > self._max_pages:
                raise PdfLimitError(
                    f"PDF has {document.page_count} pages; maximum is {self._max_pages}"
                )

            metadata = document.metadata or {}
            title_value = str(metadata.get("title") or "").strip()[:500]
            title = title_value or None
            heading = title or "Untitled"
            author_value = str(metadata.get("author") or "").strip()[:500]
            pages: list[ParsedPage] = []
            for page_index, page in enumerate(document):
                text = page.get_text("text", sort=True).strip()
                if not text:
                    continue
                if len(text) > 20_000:
                    raise PdfLimitError(
                        f"Extracted text on page {page_index + 1} exceeds 20,000 characters"
                    )
                pages.append(
                    ParsedPage(
                        page_number=page_index + 1,
                        text=text,
                        heading_path=[heading],
                    )
                )
            if not pages:
                raise InvalidPdfError(
                    "PDF contains no extractable text; scanned-only PDFs require OCR"
                )
            return ParsedPdf(
                title=title,
                author=author_value or None,
                total_pages=document.page_count,
                pages=pages,
            )
        finally:
            document.close()


class PdfIngestionService:
    def __init__(
        self,
        books: BookRepository,
        source_units: SourceUnitRepository,
        *,
        media_root: Path,
        dispatcher: PdfIngestionDispatcher | None = None,
        parser: PdfParser | None = None,
        max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    ) -> None:
        self._books = books
        self._source_units = source_units
        self._media_root = media_root
        self._dispatcher = dispatcher
        self._parser = parser or PdfParser()
        self._max_upload_bytes = max_upload_bytes

    async def register_upload(
        self,
        *,
        filename: str,
        content: bytes,
        owner_id: str,
    ) -> UploadResult:
        safe_name = Path(filename).name.strip()
        if not safe_name.lower().endswith(".pdf"):
            raise InvalidPdfError("Only PDF files are supported")
        if not content or not content.startswith(b"%PDF-"):
            raise InvalidPdfError("Upload is not a PDF")
        if len(content) > self._max_upload_bytes:
            raise PdfLimitError(
                f"PDF is {len(content)} bytes; maximum is {self._max_upload_bytes}"
            )

        pdf_hash = hashlib.sha256(content).hexdigest()
        book_identity = hashlib.sha256(
            f"{owner_id}\n{pdf_hash}".encode("utf-8")
        ).hexdigest()
        book_id = f"book_{book_identity[:24]}"
        now = utc_now()
        book = construct_document(
            BookDoc,
            book_id=book_id,
            owner_id=owner_id,
            title=self._clean_title(safe_name),
            original_filename=safe_name,
            pdf_hash=pdf_hash,
            pdf_storage_ref=f"storage://books/{book_id}/source.pdf",
            status="pending",
            total_pages=0,
            created_at=now,
            updated_at=now,
        )
        stored, created = await self._books.create_book_if_absent(book)
        if not created and stored.status != "failed":
            return UploadResult(book=book_view(stored), is_cached=True)

        if not created:
            stored.status = "pending"
            stored.error_code = None
            stored.error_detail = None
            stored.updated_at = utc_now()
            stored = await self._books.save_book(stored)

        destination = self.storage_path(stored.pdf_storage_ref)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        if self._dispatcher is not None:
            task_id = self._dispatcher.enqueue_pdf_ingestion(stored.book_id)
            return UploadResult(book=book_view(stored), task_id=task_id, is_cached=False)

        parsed = await self.parse_registered_book(stored.book_id)
        return UploadResult(book=parsed, is_cached=False)

    async def parse_registered_book(self, book_id: str) -> BookView:
        book = await self._books.get_book(book_id)
        if book is None:
            raise NotFoundError(f"Book {book_id} does not exist")
        if book.status == "parsed":
            return book_view(book)

        book.status = "parsing"
        book.updated_at = utc_now()
        await self._books.save_book(book)
        try:
            parsed = await asyncio.to_thread(
                self._parser.parse, self.storage_path(book.pdf_storage_ref)
            )
            units = normalize_pages(
                book.book_id,
                parsed.pages,
                parse_version=self._parser.parse_version,
            )
            await self._source_units.save_source_units(units)
            if parsed.title is not None:
                book.title = parsed.title
            book.author = parsed.author
            book.total_pages = parsed.total_pages
            book.parse_version = self._parser.parse_version
            book.status = "parsed"
            book.error_code = None
            book.error_detail = None
        except (InvalidPdfError, PdfLimitError) as error:
            book.status = "failed"
            book.error_code = error.code
            book.error_detail = str(error)[:2_000]
            raise
        except Exception as error:
            book.status = "failed"
            book.error_code = "pdf_parse_failed"
            book.error_detail = str(error)[:2_000]
            raise InvalidPdfError("PDF parsing failed") from error
        finally:
            book.updated_at = utc_now()
            await self._books.save_book(book)
        return book_view(book)

    async def get(self, book_id: str) -> BookView:
        book = await self._books.get_book(book_id)
        if book is None:
            raise NotFoundError(f"Book {book_id} does not exist")
        return book_view(book)

    async def list_books(self, owner_id: str | None = None) -> list[BookView]:
        return [book_view(item) for item in await self._books.list_books(owner_id)]

    async def list_source_units(self, book_id: str) -> list[SourceUnit]:
        if await self._books.get_book(book_id) is None:
            raise NotFoundError(f"Book {book_id} does not exist")
        return [
            source_unit_contract(item)
            for item in await self._source_units.list_source_units(book_id)
        ]

    async def get_page(self, book_id: str, page_number: int) -> SourceUnit:
        units = await self._source_units.list_source_units(book_id)
        matches = [
            item for item in units if item.page_start <= page_number <= item.page_end
        ]
        if len(matches) != 1:
            raise NotFoundError(f"Parsed page {page_number} does not exist for book {book_id}")
        return source_unit_contract(matches[0])

    def storage_path(self, storage_ref: str) -> Path:
        prefix = "storage://books/"
        if not storage_ref.startswith(prefix):
            raise InvalidPdfError("Book PDF has an invalid storage reference")
        relative = storage_ref.removeprefix(prefix)
        parts = Path(relative).parts
        if len(parts) != 2 or parts[1] != "source.pdf" or ".." in parts:
            raise InvalidPdfError("Book PDF has an invalid storage reference")
        return self._media_root / "books" / parts[0] / parts[1]

    @staticmethod
    def _clean_title(filename: str) -> str:
        stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
        return stem[:500] or "Untitled"


def book_view(book: BookDoc) -> BookView:
    return BookView.model_validate(
        {
            "book_id": book.book_id,
            "owner_id": book.owner_id,
            "title": book.title,
            "author": book.author,
            "original_filename": book.original_filename,
            "pdf_hash": book.pdf_hash,
            "status": book.status,
            "total_pages": book.total_pages,
            "parse_version": book.parse_version,
            "error_code": book.error_code,
            "error_detail": book.error_detail,
            "created_at": book.created_at,
            "updated_at": book.updated_at,
        }
    )
