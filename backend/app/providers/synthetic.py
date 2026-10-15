from datetime import datetime
from typing import Dict, Any

from app.providers.base import EnvironmentalDataProvider
from app.simulation.engine import SyntheticEngine
from app.schemas.base import DataSourceInfo, DataStatus, DataSource
from app.schemas.weather import WeatherReading
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.air_quality import AirQualityReading


class SyntheticDataProvider(EnvironmentalDataProvider):
    """
    Deterministic realistic simulation data provider.
    Used when no live physical station or sensor is within proximity.
    """

    async def get_weather(self, lat: float, lon: float) -> WeatherReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        w = engine.get_weather(now)

        return WeatherReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (Synthetic)",
            ),
            **w,
        )

    def get_water_level(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterLevelReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        level = engine.get_water_level(now, recent_rainfall)

        past_level = engine.get_water_level(
            now.replace(hour=(now.hour - 1) % 24), recent_rainfall * 0.8
        )
        change_1h = round(level - past_level, 3)

        trend = "STABLE"
        if change_1h > 0.04:
            trend = "RISING"
        elif change_1h < -0.04:
            trend = "FALLING"

        warning = round(engine.baseline_water_level + 1.2, 2)
        danger = round(engine.baseline_water_level + 2.0, 2)
        hist_max = round(engine.baseline_water_level + 2.8, 2)

        return WaterLevelReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
            ),
            water_level=round(level, 2),
            trend=trend,
            daily_variation=round(engine.water_level_daily_variation, 2),
            warning_level_m=warning,
            danger_level_m=danger,
            historical_max_m=hist_max,
            change_1h_m=change_1h,
            flow_rate_cumecs=round(abs(level * 12.4 + recent_rainfall * 2.1), 1),
        )

    def get_water_quality(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterQualityReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        wq = engine.get_water_quality(now, recent_rainfall)

        category = WaterQualityReading.compute_category(wq["ph"], wq["turbidity"], wq["tds"])
        ec = round(wq["tds"] * 1.56, 1)

        return WaterQualityReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
            ),
            electrical_conductivity=ec,
            category=category,
            **wq,
        )

    def get_air_quality(
        self, lat: float, lon: float, wind_speed: float = 0.0
    ) -> AirQualityReading:
        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        aq = engine.get_air_quality(now, wind_speed)

        return AirQualityReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
            ),
            **aq,
        )
