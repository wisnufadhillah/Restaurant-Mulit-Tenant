from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    tenant_id: str = Field(min_length=1)
    session_id: str = Field(default="agno-v2-default", min_length=1)
    allow_mutations: bool = False


class ChatResponse(BaseModel):
    session_id: str
    content: str
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


class GatewayRequest(BaseModel):
    model_config = {"extra": "forbid", "strict": True}
    message: str = Field(min_length=1, max_length=2000)
    tenantSlug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)
    sessionId: str = Field(min_length=1, max_length=128)
    context: str = Field(min_length=1, max_length=4096)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=12)
