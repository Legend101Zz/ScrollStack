"""Celery application and backend dispatcher."""

from __future__ import annotations

import os

from celery import Celery

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("scrollstack", broker=redis_url, backend=redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
celery_app.autodiscover_tasks(["app.worker"])


class CeleryWorkflowDispatcher:
    def enqueue_generation_run(self, run_id: str) -> None:
        celery_app.send_task("scrollstack.execute_generation_run", args=[run_id])


class CeleryPdfIngestionDispatcher:
    def enqueue_pdf_ingestion(self, book_id: str) -> str:
        result = celery_app.send_task("scrollstack.parse_pdf_source", args=[book_id])
        return str(result.id)


# Docker Compose invokes ``-A app.worker.celery_app`` and Celery looks for this name.
app = celery_app
