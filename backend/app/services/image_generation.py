"""Strict, bounded OpenRouter image generation for accepted manga plans."""

from __future__ import annotations

import base64
import binascii
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
import pymupdf

APPROVED_OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image"
OPENROUTER_IMAGE_PROMPT_VERSION = "manga-key-panel.v1"
MAX_IMAGE_RESPONSE_BYTES = 12 * 1024 * 1024


class ImageGenerationError(Exception):
    """A typed image-stage failure safe to surface through run state."""

    code = "image_provider_failed"
    retryable = True


class MissingImageCredentialError(ImageGenerationError):
    code = "openrouter_api_key_missing"


class ImageBudgetError(ImageGenerationError):
    code = "image_budget_exceeded"
    retryable = False


class InvalidImageResponseError(ImageGenerationError):
    code = "image_provider_invalid_response"


@dataclass(frozen=True)
class GeneratedImage:
    content: bytes
    mime_type: str
    width: int
    height: int
    provider: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    cost_usd: float | None
    latency_ms: int


class ImageGenerationGateway(Protocol):
    async def generate(
        self,
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
    ) -> GeneratedImage: ...


class OpenRouterImageGenerator:
    """Call exactly one approved image model, with no model fallback."""

    def __init__(
        self,
        api_key: str,
        *,
        timeout_seconds: float = 120.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise MissingImageCredentialError(
                "OPENROUTER_API_KEY is required by the image-generation stage"
            )
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def generate(
        self,
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
    ) -> GeneratedImage:
        if model != APPROVED_OPENROUTER_IMAGE_MODEL:
            raise ImageGenerationError(
                f"Image model {model!r} is not the approved pinned OpenRouter model"
            )
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt[:1_500]}],
            "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": aspect_ratio},
        }
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "HTTP-Referer": "https://scrollstack.local",
                        "X-Title": "ScrollStack",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as error:
            raise ImageGenerationError(
                f"OpenRouter image request failed at the transport layer: {type(error).__name__}"
            ) from error
        latency_ms = max(0, round((time.monotonic() - started) * 1_000))
        if response.status_code != 200:
            raise ImageGenerationError(
                f"OpenRouter image request returned HTTP {response.status_code}"
            )
        try:
            body = response.json()
        except ValueError as error:
            raise InvalidImageResponseError(
                "OpenRouter image response was not valid JSON"
            ) from error
        image_url = self._find_image_url(body)
        mime_type, image_bytes = self._decode_data_url(image_url)
        width, height = self._image_dimensions(image_bytes)
        usage = body.get("usage") if isinstance(body, dict) else None
        usage = usage if isinstance(usage, dict) else {}
        return GeneratedImage(
            content=image_bytes,
            mime_type=mime_type,
            width=width,
            height=height,
            provider="openrouter",
            model=model,
            input_tokens=self._optional_int(usage.get("prompt_tokens")),
            output_tokens=self._optional_int(usage.get("completion_tokens")),
            cost_usd=self._optional_float(usage.get("cost")),
            latency_ms=latency_ms,
        )

    async def generate_with_references(
        self,
        *,
        prompt: str,
        model: str,
        aspect_ratio: str,
        reference_images: list[tuple[bytes, str]],
    ) -> GeneratedImage:
        """Generate through OpenRouter's image API with private inline references."""

        if model != APPROVED_OPENROUTER_IMAGE_MODEL:
            raise ImageGenerationError(
                f"Image model {model!r} is not the approved pinned OpenRouter model"
            )
        if len(reference_images) > 3:
            raise ImageGenerationError("The pinned image model accepts at most three references")
        input_references: list[dict[str, object]] = []
        for content, mime_type in reference_images:
            if mime_type not in {"image/png", "image/jpeg", "image/webp"}:
                raise ImageGenerationError(f"Unsupported reference MIME type {mime_type!r}")
            if not content or len(content) > MAX_IMAGE_RESPONSE_BYTES:
                raise ImageGenerationError("Reference image bytes are outside the bounded limit")
            encoded = base64.b64encode(content).decode("ascii")
            input_references.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                }
            )
        payload: dict[str, object] = {
            "model": model,
            "prompt": prompt[:4_000],
            "n": 1,
            "aspect_ratio": aspect_ratio,
            "output_format": "png",
        }
        if input_references:
            payload["input_references"] = input_references
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/images",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "HTTP-Referer": "https://scrollstack.local",
                        "X-Title": "ScrollStack",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as error:
            raise ImageGenerationError(
                f"OpenRouter reference image request failed: {type(error).__name__}"
            ) from error
        latency_ms = max(0, round((time.monotonic() - started) * 1_000))
        if response.status_code != 200:
            raise ImageGenerationError(
                f"OpenRouter image request returned HTTP {response.status_code}"
            )
        try:
            body = response.json()
        except ValueError as error:
            raise InvalidImageResponseError(
                "OpenRouter image response was not valid JSON"
            ) from error
        content, mime_type = self._decode_image_api_response(body)
        width, height = self._image_dimensions(content)
        usage = body.get("usage") if isinstance(body, dict) else None
        usage = usage if isinstance(usage, dict) else {}
        return GeneratedImage(
            content=content,
            mime_type=mime_type,
            width=width,
            height=height,
            provider="openrouter",
            model=model,
            input_tokens=self._optional_int(usage.get("prompt_tokens")),
            output_tokens=self._optional_int(usage.get("completion_tokens")),
            cost_usd=self._optional_float(usage.get("cost")),
            latency_ms=latency_ms,
        )

    @staticmethod
    def _decode_image_api_response(body: Any) -> tuple[bytes, str]:
        if not isinstance(body, dict):
            raise InvalidImageResponseError("OpenRouter image response must be an object")
        data = body.get("data")
        if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
            raise InvalidImageResponseError("OpenRouter image response omitted its single image")
        encoded = data[0].get("b64_json")
        mime_type = data[0].get("media_type") or "image/png"
        if not isinstance(encoded, str) or not isinstance(mime_type, str):
            raise InvalidImageResponseError("OpenRouter image response has invalid image fields")
        if mime_type not in {"image/png", "image/jpeg", "image/webp"}:
            raise InvalidImageResponseError(f"Unsupported image MIME type {mime_type!r}")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as error:
            raise InvalidImageResponseError("Image payload is not valid base64") from error
        if not content or len(content) > MAX_IMAGE_RESPONSE_BYTES:
            raise InvalidImageResponseError(
                f"Image payload must be between 1 and {MAX_IMAGE_RESPONSE_BYTES} bytes"
            )
        return content, mime_type

    @staticmethod
    def _find_image_url(body: Any) -> str:
        if not isinstance(body, dict):
            raise InvalidImageResponseError("OpenRouter image response must be an object")
        choices = body.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            raise InvalidImageResponseError("OpenRouter image response omitted choices")
        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise InvalidImageResponseError("OpenRouter image response omitted its message")
        images = message.get("images")
        if isinstance(images, list):
            for image in images:
                if not isinstance(image, dict):
                    continue
                image_url = image.get("image_url")
                if isinstance(image_url, dict) and isinstance(image_url.get("url"), str):
                    return str(image_url["url"])
        content = message.get("content")
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict) or part.get("type") not in {"image", "image_url"}:
                    continue
                image_url = part.get("image_url")
                if isinstance(image_url, dict) and isinstance(image_url.get("url"), str):
                    return str(image_url["url"])
        raise InvalidImageResponseError("OpenRouter image response contained no image payload")

    @staticmethod
    def _decode_data_url(image_url: str) -> tuple[str, bytes]:
        if not image_url.startswith("data:image/") or ";base64," not in image_url:
            raise InvalidImageResponseError("Image payload must be an inline base64 data URL")
        header, encoded = image_url.split(",", 1)
        mime_type = header[5:].split(";", 1)[0]
        if mime_type not in {"image/png", "image/jpeg", "image/webp"}:
            raise InvalidImageResponseError(f"Unsupported image MIME type {mime_type!r}")
        try:
            payload = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as error:
            raise InvalidImageResponseError("Image payload is not valid base64") from error
        if not payload or len(payload) > MAX_IMAGE_RESPONSE_BYTES:
            raise InvalidImageResponseError(
                f"Image payload must be between 1 and {MAX_IMAGE_RESPONSE_BYTES} bytes"
            )
        return mime_type, payload

    @staticmethod
    def _image_dimensions(payload: bytes) -> tuple[int, int]:
        try:
            pixmap = pymupdf.Pixmap(payload)
        except Exception as error:
            raise InvalidImageResponseError(
                "Provider payload is not a readable raster image"
            ) from error
        if pixmap.width <= 0 or pixmap.height <= 0:
            raise InvalidImageResponseError("Provider image has invalid dimensions")
        return pixmap.width, pixmap.height

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        return value if isinstance(value, int) and value >= 0 else None

    @staticmethod
    def _optional_float(value: Any) -> float | None:
        if isinstance(value, (int, float)) and value >= 0:
            return float(value)
        return None
