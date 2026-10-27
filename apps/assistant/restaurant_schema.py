"""Strict validation for public restaurant API responses."""
from datetime import datetime
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime


class StrictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class OutletInfo(StrictResponse):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    address: Annotated[str, Field(max_length=2000)]
    contactPhone: Annotated[str, Field(max_length=100)]
    timezone: Literal["Asia/Jakarta"]
    durationMinutes: Annotated[int, Field(gt=0)]
    minNoticeMinutes: Annotated[int, Field(ge=0)]
    maxAdvanceDays: Annotated[int, Field(gt=0)]
    cancelCutoffMinutes: Annotated[int, Field(ge=0)]
    maxPartySize: Annotated[int, Field(gt=0)]


class RestaurantInfo(StrictResponse):
    slug: Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)]
    name: Annotated[str, Field(min_length=1, max_length=200)]
    outlets: Annotated[list[OutletInfo], Field(max_length=50)]


class RestaurantResponse(StrictResponse):
    data: RestaurantInfo
    retrieved_at: AwareDatetime
    source: Literal["restaurant_api"]
