from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .base import BaseReading, DataSourceInfo

class WeatherReading(BaseReading):
    temperature_2m: float
    relative_humidity_2m: float
    apparent_temperature: float
    precipitation: float
    rain: float
    weather_code: int
    surface_pressure: float
    wind_speed_10m: float
    wind_direction_10m: float
    wind_gusts_10m: float
    cloud_cover: float
    uv_index: float
    visibility: float

class DailyForecast(BaseModel):
    date: datetime
    temperature_2m_max: float
    temperature_2m_min: float
    precipitation_sum: float
    wind_speed_10m_max: float
    weather_code: int

class HourlyForecast(BaseModel):
    timestamp: datetime
    temperature_2m: float
    relative_humidity_2m: float
    precipitation: float
    wind_speed_10m: float
    uv_index: float
    weather_code: int

class WeatherForecast(BaseModel):
    data_source: DataSourceInfo
    hourly: List[HourlyForecast]
    daily: List[DailyForecast]

class WeatherHistory(BaseModel):
    data_source: DataSourceInfo
    hourly: List[HourlyForecast]
