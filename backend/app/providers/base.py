from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime

from app.schemas.weather import WeatherReading
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.air_quality import AirQualityReading


class EnvironmentalDataProvider(ABC):
    """
    Abstract interface for environmental data sources.
    Implementations include:
    - SyntheticDataProvider (realistic mathematical simulation)
    - WeatherAPIProvider (Open-Meteo external live weather API with offline fallback)
    - WaterStationProvider (government and municipal monitoring stations)
    - IoTSensorProvider (ESP32, MQTT telemetry nodes)
    """

    @abstractmethod
    async def get_weather(self, lat: float, lon: float) -> WeatherReading:
        """Fetch or calculate current weather reading."""
        pass

    @abstractmethod
    def get_water_level(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterLevelReading:
        """Fetch or calculate water level reading."""
        pass

    @abstractmethod
    def get_water_quality(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterQualityReading:
        """Fetch or calculate water quality parameters (pH, TDS, turbidity, DO, temp)."""
        pass

    @abstractmethod
    def get_air_quality(
        self, lat: float, lon: float, wind_speed: float = 0.0
    ) -> AirQualityReading:
        """Fetch or calculate air quality metrics (AQI, PM2.5, PM10, gases)."""
        pass
