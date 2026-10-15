from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class DataStatus(str, Enum):
    LIVE = "LIVE"
    ESTIMATED = "ESTIMATED"
    SIMULATED = "SIMULATED"

class DataSource(str, Enum):
    MONITORING_STATION = "MONITORING_STATION"
    IOT_SENSOR = "IOT_SENSOR"
    WEATHER_API = "WEATHER_API"
    SYNTHETIC = "SYNTHETIC"

class DataSourceInfo(BaseModel):
    status: DataStatus
    source: DataSource
    source_label: str
    updated_at: datetime = Field(default_factory=utc_now)

class BaseReading(BaseModel):
    timestamp: datetime = Field(default_factory=utc_now)
    data_source: DataSourceInfo
