import httpx
from typing import Dict, Any, Optional
from datetime import datetime

from app.providers.base import EnvironmentalDataProvider
from app.simulation.engine import SyntheticEngine
from app.schemas.base import DataSourceInfo, DataStatus, DataSource
from app.schemas.weather import WeatherReading
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.air_quality import AirQualityReading


class WeatherAPIProvider(EnvironmentalDataProvider):
    """
    Live weather provider using Open-Meteo REST API.
    Gracefully falls back to deterministic simulation if the external service
    is unreachable, slow, or offline.
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self):
        self.synthetic_engine = None

    async def fetch_open_meteo(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,uv_index,visibility",
            "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
            "timezone": "auto",
            "forecast_days": 7,
            "past_days": 7,
        }
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                if response.status_code == 200:
                    return response.json()
        except Exception:
            pass
        return None

    async def get_weather(self, lat: float, lon: float) -> WeatherReading:
        open_meteo_data = await self.fetch_open_meteo(lat, lon)

        if open_meteo_data and "current" in open_meteo_data:
            current = open_meteo_data["current"]
            return WeatherReading(
                timestamp=datetime.utcnow(),
                data_source=DataSourceInfo(
                    status=DataStatus.LIVE,
                    source=DataSource.WEATHER_API,
                    source_label="Open-Meteo (Live)",
                ),
                temperature_2m=current.get("temperature_2m", 0.0),
                relative_humidity_2m=current.get("relative_humidity_2m", 0.0),
                apparent_temperature=current.get("apparent_temperature", 0.0),
                precipitation=current.get("precipitation", 0.0),
                rain=current.get("rain", 0.0),
                weather_code=current.get("weather_code", 0),
                surface_pressure=current.get("surface_pressure", 1013.0),
                wind_speed_10m=current.get("wind_speed_10m", 0.0),
                wind_direction_10m=current.get("wind_direction_10m", 0.0),
                wind_gusts_10m=current.get("wind_gusts_10m", 0.0),
                cloud_cover=current.get("cloud_cover", 0.0),
                uv_index=current.get("uv_index", 0.0),
                visibility=current.get("visibility", 10000.0),
            )

        # Fallback to realistic simulation
        engine = SyntheticEngine(lat, lon)
        w = engine.get_weather(datetime.utcnow())
        return WeatherReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (Weather API Offline)",
            ),
            **w,
        )

    async def get_raw_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Used by forecast and environment endpoints."""
        data = await self.fetch_open_meteo(lat, lon)
        if data:
            data["_is_live"] = True
            return data
        engine = SyntheticEngine(lat, lon)
        synthetic_payload = engine.generate_weather_forecast_response(hours=48)
        synthetic_payload["_is_live"] = False
        return synthetic_payload

    # Delegated methods for abstract class compatibility
    def get_water_level(self, lat: float, lon: float, recent_rainfall: float = 0.0) -> WaterLevelReading:
        engine = SyntheticEngine(lat, lon)
        level = engine.get_water_level(datetime.utcnow(), recent_rainfall)
        return WaterLevelReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine",
            ),
            water_level=round(level, 2),
            trend="STABLE",
            daily_variation=0.2,
            warning_level_m=5.5,
            danger_level_m=6.5,
        )

    def get_water_quality(self, lat: float, lon: float, recent_rainfall: float = 0.0) -> WaterQualityReading:
        engine = SyntheticEngine(lat, lon)
        wq = engine.get_water_quality(datetime.utcnow(), recent_rainfall)
        return WaterQualityReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine",
            ),
            category="GOOD",
            **wq,
        )

    def get_air_quality(self, lat: float, lon: float, wind_speed: float = 0.0) -> AirQualityReading:
        engine = SyntheticEngine(lat, lon)
        aq = engine.get_air_quality(datetime.utcnow(), wind_speed)
        return AirQualityReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine",
            ),
            **aq,
        )


# Backward compatibility alias
OpenMeteoProvider = WeatherAPIProvider
