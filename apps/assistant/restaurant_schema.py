"""Strict validation for public restaurant API responses."""
from datetime import datetime
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator


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
    menuItems: list["MenuItemInfo"] = []
    diningTables: list["DiningTableInfo"] = []
    openingHours: list["OpeningHourInfo"] = []
    todayHours: "TodayHourInfo | None" = None
    weeklyHours: Annotated[list["WeeklyHourInfo"], Field(max_length=7)] = []


class MenuItemInfo(StrictResponse):
    id: str
    name: Annotated[str, Field(min_length=1)]
    category: Annotated[str, Field(min_length=1)]
    price: Annotated[int, Field(ge=0)]
    description: str
    isAvailable: bool


class DiningTableInfo(StrictResponse):
    id: str
    tableNumber: Annotated[str, Field(min_length=1)]
    capacity: Annotated[int, Field(gt=0)]
    area: Annotated[str, Field(min_length=1)]
    status: Literal["available", "reserved", "maintenance"]


class OpeningHourInfo(StrictResponse):
    dayOfWeek: Annotated[int, Field(ge=0, le=6)]
    openMinutes: Annotated[int, Field(ge=0, le=1439)]
    closeMinutes: Annotated[int, Field(ge=1, le=1440)]
    isOpen: bool


class WeeklyHourInfo(StrictResponse):
    weekday: Annotated[int, Field(ge=0, le=6)]
    openMinute: Annotated[int, Field(ge=0, le=1439)] | None
    closeMinute: Annotated[int, Field(ge=1, le=1440)] | None

    @model_validator(mode='after')
    def valid_interval(self):
        if (self.openMinute is None) != (self.closeMinute is None):
            raise ValueError('Incomplete weekly interval')
        if self.openMinute is not None and self.openMinute >= self.closeMinute:
            raise ValueError('Invalid weekly interval')
        return self

class TodayHourInfo(WeeklyHourInfo):
    weekday: Annotated[int, Field(ge=0, le=6)] = 0
    date: Annotated[str, Field(pattern=r'^\d{4}-\d{2}-\d{2}$')]
    timezone: Literal['Asia/Jakarta']
    configured: bool
    source: Literal['special', 'weekly', 'unconfigured']

    @model_validator(mode='after')
    def valid_source(self):
        if self.configured != (self.source != 'unconfigured'):
            raise ValueError('Inconsistent schedule source')
        if not self.configured and self.openMinute is not None:
            raise ValueError('Unconfigured schedule has hours')
        return self

OutletInfo.model_rebuild()


class RestaurantInfo(StrictResponse):
    slug: Annotated[str, Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)]
    name: Annotated[str, Field(min_length=1, max_length=200)]
    outlets: Annotated[list[OutletInfo], Field(max_length=50)]


class RestaurantResponse(StrictResponse):
    data: RestaurantInfo
    retrieved_at: AwareDatetime
    source: Literal["restaurant_api"]
