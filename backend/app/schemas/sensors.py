from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SensorIngestPayload(BaseModel):
    sensor_id: str = Field(..., min_length=2, max_length=100, description="Unique physical sensor ID (e.g., SENSOR-ESP32-01)")
    well_id: Optional[str] = Field(None, max_length=50, description="Target registered well ID if known")
    device_token: Optional[str] = Field(None, description="Shared secret API key / bearer token for this device")
    timestamp: Optional[datetime] = Field(None, description="ISO timestamp of observation (defaults to server receive time)")

    # Telemetry measurements (at least one parameter should be provided)
    water_level_m: Optional[float] = Field(None, ge=0.0, le=100.0, description="Groundwater depth or level in meters")
    ph: Optional[float] = Field(None, ge=0.0, le=14.0, description="pH index (0.0 to 14.0)")
    tds_ppm: Optional[float] = Field(None, ge=0.0, le=10000.0, description="Total dissolved solids in ppm")
    turbidity_ntu: Optional[float] = Field(None, ge=0.0, le=1000.0, description="Turbidity in Nephelometric Turbidity Units")
    dissolved_oxygen_mg_l: Optional[float] = Field(None, ge=0.0, le=30.0, description="Dissolved oxygen concentration in mg/L")
    temperature_c: Optional[float] = Field(None, ge=-20.0, le=80.0, description="Water temperature in Celsius")

    # Diagnostic metadata
    battery_level_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Device battery percentage")
    signal_strength_rssi: Optional[int] = Field(None, description="RSSI signal strength in dBm")
    raw_payload: Optional[Dict[str, Any]] = Field(None, description="Optional raw JSON packet from ESP32/microcontroller")


class SensorIngestResponse(BaseModel):
    success: bool
    status: str  # "LIVE", "ESTIMATED", "SIMULATED", "UNAVAILABLE"
    sensor_id: str
    well_id: str
    reading_id: int
    received_at: datetime
    message: str


class SensorRegisterRequest(BaseModel):
    id: str = Field(..., min_length=2, max_length=50, description="Desired unique sensor hardware ID")
    well_id: str = Field(..., min_length=2, max_length=50, description="Associated registered well ID")
    sensor_type: str = Field("Multi-Parameter Groundwater Sonde", max_length=100)
    model: str = Field("AquaSense-IoT-ESP32", max_length=100)
    measurement_parameter: str = Field("water_level,ph,tds,turbidity,dissolved_oxygen,temperature", max_length=255)
    units: str = Field("m,pH,ppm,NTU,mg/L,°C", max_length=100)
    is_installed: bool = True
    device_api_key: Optional[str] = Field(None, min_length=8, description="Optional manual device API key, or auto-generated if omitted")


class SensorDetailResponse(BaseModel):
    id: str
    well_id: str
    sensor_type: str
    model: str
    measurement_parameter: str
    units: str
    is_installed: bool
    is_active: bool
    status: str  # "ONLINE", "STALE", "OFFLINE", "UNINITIALIZED"
    data_source: str
    last_seen_at: Optional[datetime] = None
    installed_at: datetime
    latest_reading: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
