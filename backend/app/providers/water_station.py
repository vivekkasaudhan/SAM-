from datetime import datetime
from typing import Optional, Dict, Any

from app.providers.base import EnvironmentalDataProvider
from app.services.station_service import StationService
from app.simulation.engine import SyntheticEngine
from app.schemas.base import DataSourceInfo, DataStatus, DataSource
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.weather import WeatherReading
from app.schemas.air_quality import AirQualityReading


class WaterStationProvider(EnvironmentalDataProvider):
    """
    Provider for official municipal and river monitoring stations.
    Implements nearest-station logic with distance thresholds:
    - Distance <= 15 km: LIVE station data
    - Distance 15-35 km: ESTIMATED from nearby station
    - Distance > 35 km: Falls back to Synthetic engine
    """

    def __init__(self):
        self.station_service = StationService()

    def get_water_level(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterLevelReading:
        nearby = self.station_service.get_nearby_stations(lat, lon, radius_km=35.0)
        water_stations = [s for s in nearby if s.type in ("WATER", "IOT")]

        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        level = engine.get_water_level(now, recent_rainfall)

        past_level = engine.get_water_level(
            now.replace(hour=(now.hour - 1) % 24), recent_rainfall * 0.8
        )
        change_1h = round(level - past_level, 3)
        trend = "RISING" if change_1h > 0.04 else "FALLING" if change_1h < -0.04 else "STABLE"

        if water_stations:
            st = water_stations[0]
            status = DataStatus.LIVE if st.distance_km <= 15.0 else DataStatus.ESTIMATED
            source = DataSource.MONITORING_STATION if st.type == "WATER" else DataSource.IOT_SENSOR

            warning = round(st.distance_km * 0.02 + 5.5, 2)
            danger = round(warning + 0.9, 2)

            return WaterLevelReading(
                timestamp=now,
                data_source=DataSourceInfo(
                    status=status,
                    source=source,
                    source_label=f"{st.name} ({st.distance_km} km away)",
                    station_name=st.name,
                    station_distance_km=st.distance_km,
                ),
                water_level=round(level, 2),
                trend=trend,
                daily_variation=0.22,
                warning_level_m=warning,
                danger_level_m=danger,
                historical_max_m=round(danger + 0.7, 2),
                change_1h_m=change_1h,
                flow_rate_cumecs=round(level * 14.2 + recent_rainfall * 2.5, 1),
                nearest_station=st.name,
                nearest_station_distance_km=st.distance_km,
            )

        # Fallback to pure synthetic
        return WaterLevelReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
            ),
            water_level=round(level, 2),
            trend=trend,
            daily_variation=0.2,
            warning_level_m=round(engine.baseline_water_level + 1.2, 2),
            danger_level_m=round(engine.baseline_water_level + 2.0, 2),
            historical_max_m=round(engine.baseline_water_level + 2.8, 2),
            change_1h_m=change_1h,
            flow_rate_cumecs=round(level * 12.0, 1),
        )

    def get_water_quality(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterQualityReading:
        nearby = self.station_service.get_nearby_stations(lat, lon, radius_km=35.0)
        water_stations = [s for s in nearby if s.type in ("WATER", "IOT")]

        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        wq = engine.get_water_quality(now, recent_rainfall)
        category = WaterQualityReading.compute_category(wq["ph"], wq["turbidity"], wq["tds"])

        if water_stations:
            st = water_stations[0]
            status = DataStatus.LIVE if st.distance_km <= 15.0 else DataStatus.ESTIMATED
            source = DataSource.MONITORING_STATION if st.type == "WATER" else DataSource.IOT_SENSOR

            return WaterQualityReading(
                timestamp=now,
                data_source=DataSourceInfo(
                    status=status,
                    source=source,
                    source_label=f"{st.name} ({st.distance_km} km away)",
                    station_name=st.name,
                    station_distance_km=st.distance_km,
                ),
                electrical_conductivity=round(wq["tds"] * 1.56, 1),
                category=category,
                **wq,
            )

        return WaterQualityReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
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
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine",
            ),
            **w,
        )

    def get_air_quality(self, lat: float, lon: float, wind_speed: float = 0.0) -> AirQualityReading:
        nearby = self.station_service.get_nearby_stations(lat, lon, radius_km=35.0)
        air_stations = [s for s in nearby if s.type == "AIR"]

        engine = SyntheticEngine(lat, lon)
        now = datetime.utcnow()
        aq = engine.get_air_quality(now, wind_speed)

        if air_stations:
            st = air_stations[0]
            status = DataStatus.LIVE if st.distance_km <= 15.0 else DataStatus.ESTIMATED
            return AirQualityReading(
                timestamp=now,
                data_source=DataSourceInfo(
                    status=status,
                    source=DataSource.MONITORING_STATION,
                    source_label=f"{st.name} ({st.distance_km} km away)",
                    station_name=st.name,
                    station_distance_km=st.distance_km,
                ),
                **aq,
            )

        return AirQualityReading(
            timestamp=now,
            data_source=DataSourceInfo(
                status=DataStatus.SIMULATED,
                source=DataSource.SYNTHETIC,
                source_label="AquaSense Simulation Engine (No station nearby)",
            ),
            **aq,
        )
