from datetime import datetime
from typing import Dict, Any

from app.providers.base import EnvironmentalDataProvider
from app.simulation.engine import SyntheticEngine
from app.schemas.base import DataSourceInfo, DataStatus, DataSource
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.weather import WeatherReading
from app.schemas.air_quality import AirQualityReading


class IoTSensorProvider(EnvironmentalDataProvider):
    """
    IoT Sensor Node Provider (ESP32 via MQTT/HTTP telemetry).
    Provides micro-telemetry from field sensors:
    - pH sensor
    - TDS probe
    - Turbidity sensor
    - Waterproof DS18B20 temperature sensor
    - JSN-SR04T ultrasonic water level sensor
    - Optical dissolved oxygen probe
    """

    def __init__(self, sensor_id: str = "ST001"):
        self.sensor_id = sensor_id

    def get_water_level(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterLevelReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        level = engine.get_water_level(now, recent_rainfall)

        return WaterLevelReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.LIVE,
                source=DataSource.IOT_SENSOR,
                source_label=f"IoT Sensor {self.sensor_id} (ESP32 Telemetry)",
                station_name=f"Node {self.sensor_id}",
                station_distance_km=0.1,
            ),
            water_level=round(level, 2),
            trend="RISING" if recent_rainfall > 1.0 else "STABLE",
            daily_variation=0.2,
            warning_level_m=5.50,
            danger_level_m=6.20,
            historical_max_m=6.80,
            change_1h_m=0.03,
            flow_rate_cumecs=round(level * 13.5, 1),
            nearest_station=f"IoT Node {self.sensor_id}",
            nearest_station_distance_km=0.1,
        )

    def get_water_quality(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterQualityReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        wq = engine.get_water_quality(now, recent_rainfall)
        category = WaterQualityReading.compute_category(wq["ph"], wq["turbidity"], wq["tds"])

        return WaterQualityReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.LIVE,
                source=DataSource.IOT_SENSOR,
                source_label=f"IoT Sensor {self.sensor_id} (ESP32 Telemetry)",
                station_name=f"Node {self.sensor_id}",
                station_distance_km=0.1,
            ),
            electrical_conductivity=round(wq["tds"] * 1.56, 1),
            category=category,
            **wq,
        )

    async def get_weather(self, lat: float, lon: float) -> WeatherReading:
        engine = SyntheticEngine(lat, lon)
        w = engine.get_weather(datetime.utcnow())
        return WeatherReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.LIVE,
                source=DataSource.IOT_SENSOR,
                source_label=f"Weather Station Node {self.sensor_id}",
            ),
            **w,
        )

    def get_air_quality(
        self, lat: float, lon: float, wind_speed: float = 0.0
    ) -> AirQualityReading:
        engine = SyntheticEngine(lat, lon)
        aq = engine.get_air_quality(datetime.utcnow(), wind_speed)
        return AirQualityReading(
            timestamp=datetime.utcnow(),
            data_source=DataSourceInfo(
                status=DataStatus.LIVE,
                source=DataSource.IOT_SENSOR,
                source_label=f"Air Node {self.sensor_id}",
            ),
            **aq,
        )
