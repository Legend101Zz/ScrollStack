"""Celery-owned PDF ingestion and durable generation stage entrypoints."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from app.persistence.mongo import initialize_mongo
from app.persistence.repositories import BeanieRepositories
from app.services.agent_worker import HttpAgentWorkerClient
from app.services.generation_workflow import GenerationWorkflowService
from app.services.image_generation import OpenRouterImageGenerator
from app.services.pdf_ingestion import PdfIngestionService

from .celery_app import celery_app


@celery_app.task(  # type: ignore[misc]
    name="scrollstack.execute_generation_run", bind=True, max_retries=2
)
def execute_generation_run(self: Any, run_id: str) -> dict[str, object]:
    del self

    async def run() -> dict[str, object]:
        mongo_uri = os.environ["MONGODB_URI"]
        parsed = urlparse(mongo_uri)
        client = await initialize_mongo(mongo_uri, parsed.path.lstrip("/") or "scrollstack")
        try:
            repositories = BeanieRepositories()
            agentic_enabled = os.getenv("AGENTIC_MANGA_PIPELINE_V1", "false").lower() == "true"
            agent_worker = None
            agent_worker_token = os.getenv("AGENT_WORKER_TOKEN")
            if agentic_enabled and agent_worker_token:
                agent_worker = HttpAgentWorkerClient(
                    base_url=os.getenv("AGENT_WORKER_URL", "http://agent_worker:8788"),
                    token=agent_worker_token,
                )
            openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
            image_provider = (
                OpenRouterImageGenerator(openrouter_api_key) if openrouter_api_key else None
            )
            result = await GenerationWorkflowService(
                repositories,
                agent_worker=agent_worker,
                agentic_enabled=agentic_enabled,
                image_provider=image_provider,
                media_root=Path(os.getenv("MEDIA_ROOT", "/data/media")),
                image_model=os.getenv(
                    "IMAGE_MODEL",
                    "google/gemini-2.5-flash-image",
                ),
            ).execute(run_id)
            return result.model_dump(mode="json")
        finally:
            await client.close()

    return asyncio.run(run())


@celery_app.task(name="scrollstack.parse_pdf_source")  # type: ignore[misc]
def parse_pdf_source(book_id: str) -> dict[str, object]:
    async def run() -> dict[str, object]:
        mongo_uri = os.environ["MONGODB_URI"]
        parsed = urlparse(mongo_uri)
        client = await initialize_mongo(mongo_uri, parsed.path.lstrip("/") or "scrollstack")
        try:
            repositories = BeanieRepositories()
            service = PdfIngestionService(
                repositories,
                repositories,
                media_root=Path(os.getenv("MEDIA_ROOT", "/data/media")),
            )
            book = await service.parse_registered_book(book_id)
            return {
                "book_id": book.book_id,
                "status": book.status,
                "total_pages": book.total_pages,
            }
        finally:
            await client.close()

    return asyncio.run(run())
