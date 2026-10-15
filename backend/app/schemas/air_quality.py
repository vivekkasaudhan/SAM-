from pydantic import BaseModel
from typing import List
from .base import BaseReading, DataSourceInfo

class AirQualityReading(BaseReading):
    aqi: float
    pm25: float
    pm10: float
    no2: float
    so2: float
    o3: float
    co: float
    category: str # "Good", "Moderate", "Unhealthy", etc.

class AirQualityHistory(BaseModel):
    data_source: DataSourceInfo
    history: List[AirQualityReading]
