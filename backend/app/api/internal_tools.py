"""Internal agent domain-tool HTTP boundary."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, HTTPException, status

from app.container import ControlPlaneServices
from app.services.domain_tools import DomainToolRequest, DomainToolResponse


def internal_tools_router(
    services: ControlPlaneServices, *, service_token: str
) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/internal/v1/agent-tools/{tool_name}",
        response_model=DomainToolResponse,
        tags=["internal-agent-tools"],
    )
    async def execute_agent_tool(
        tool_name: str,
        request: DomainToolRequest,
        authorization: str | None = Header(default=None),
    ) -> DomainToolResponse:
        expected = f"Bearer {service_token}"
        if authorization is None or not hmac.compare_digest(authorization, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "unauthorized", "message": "Bearer service token required"},
            )
        return await services.domain_tools.execute(tool_name, request)

    return router
