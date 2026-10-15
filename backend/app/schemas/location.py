from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

class LocationInfo(BaseModel):
    lat: float
    lon: float
    display_name: str
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

class ReadingSummary(BaseModel):
    water_level_m: Optional[float] = None
    ph: Optional[float] = None
    tds_ppm: Optional[float] = None
    turbidity_ntu: Optional[float] = None
    dissolved_oxygen_mg_l: Optional[float] = None
    temperature_c: Optional[float] = None
    status: Optional[str] = None
    source: Optional[str] = None
    timestamp: Optional[datetime] = None

class NearbyStation(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    type: str # "WATER", "AIR", "IOT", "WELL"
    distance_km: float
    is_active: bool
    latest_reading: Optional[ReadingSummary] = None
    warning_level_m: Optional[float] = None
    danger_level_m: Optional[float] = None
    location_description: Optional[str] = None
