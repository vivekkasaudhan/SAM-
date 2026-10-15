from datetime import datetime
from typing import Dict, Any, Optional

from app.providers.weather_api import WeatherAPIProvider
from app.providers.water_station import WaterStationProvider
from app.providers.synthetic import SyntheticDataProvider
from app.providers.iot_sensor import IoTSensorProvider
from app.services.location_service import LocationService
from app.services.risk_service import RiskService
from app.services.station_service import StationService

from app.schemas.weather import WeatherReading
from app.schemas.water import WaterLevelReading, WaterQualityReading
from app.schemas.air_quality import AirQualityReading
from app.schemas.environment import EnvironmentResponse
from app.schemas.risk import RiskAssessment
from app.schemas.location import LocationInfo


class EnvironmentService:
    """
    Central orchestration service for environmental intelligence.
    Routes queries to appropriate providers based on nearest station proximity,
    IoT sensor nodes, weather API availability, and mathematical simulation.
    """

    def __init__(self):
        self.weather_provider = WeatherAPIProvider()
        self.station_provider = WaterStationProvider()
        self.synthetic_provider = SyntheticDataProvider()
        self.iot_provider = IoTSensorProvider("ST001")
        self.station_service = StationService()
        self.location_service = LocationService()
        self.risk_service = RiskService()

    async def get_weather(self, lat: float, lon: float) -> WeatherReading:
        return await self.weather_provider.get_weather(lat, lon)

    def get_water_level(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterLevelReading:
        # Check if a registered Well is within proximity (<15 km)
        nearby = self.station_service.get_nearby_stations(lat, lon, radius_km=15.0)
        wells = [s for s in nearby if s.type == "WELL"]
        if wells:
            try:
                from app.models.database import SessionLocal, Well, Reading, DataStatusEnum, DataSourceEnum
                from app.schemas.base import DataSourceInfo, DataStatus, DataSource
                session = SessionLocal()
                try:
                    w_rec = session.query(Well).filter(Well.id == wells[0].id).first()
                    latest_reading = (
                        session.query(Reading)
                        .filter(Reading.well_id == wells[0].id)
                        .order_by(Reading.timestamp.desc())
                        .first()
                    )
                    if w_rec and latest_reading:
                        dist = wells[0].distance_km
                        
                        # Strict Status Attribution (Requirements 6 & 7)
                        # Demo simulated wells must remain SIMULATED
                        reading_status_val = (
                            latest_reading.status.value
                            if hasattr(latest_reading.status, "value")
                            else str(latest_reading.status)
                        )
                        reading_source_val = (
                            latest_reading.source.value
                            if hasattr(latest_reading.source, "value")
                            else str(latest_reading.source)
                        )

                        if reading_status_val == "SIMULATED" or reading_source_val == "SYNTHETIC":
                            status = DataStatus.SIMULATED
                            source = DataSource.SYNTHETIC
                            source_label = f"{w_rec.name} (Simulated Demo Well Telemetry)"
                        elif reading_status_val == "LIVE":
                            # Check staleness if physical sensor
                            from datetime import datetime, timezone
                            now_utc = datetime.now(timezone.utc)
                            r_ts = latest_reading.timestamp
                            if r_ts.tzinfo is None:
                                r_ts = r_ts.replace(tzinfo=timezone.utc)
                            age_mins = (now_utc - r_ts).total_seconds() / 60.0

                            if age_mins > 1440:
                                status = DataStatus.UNAVAILABLE
                                source_label = f"{w_rec.name} (Physical Sensor Offline - Stale {int(age_mins/60)}h)"
                            elif age_mins > 30 or dist > 1.0:
                                status = DataStatus.ESTIMATED
                                source_label = f"{w_rec.name} (Physical Sensor - Estimated by distance/time)"
                            else:
                                status = DataStatus.LIVE
                                source_label = f"{w_rec.name} (Physical Sensor - Live Telemetry)"
                            source = DataSource.IOT_SENSOR
                        else:
                            status = DataStatus.ESTIMATED
                            source = DataSource.MONITORING_STATION
                            source_label = f"{w_rec.name} ({dist} km away)"

                        recent_readings = (
                            session.query(Reading)
                            .filter(Reading.well_id == wells[0].id)
                            .order_by(Reading.timestamp.desc())
                            .limit(2)
                            .all()
                        )
                        change_1h = None
                        trend_val = "STABLE"
                        if len(recent_readings) >= 2:
                            diff = round(recent_readings[0].water_level_m - recent_readings[1].water_level_m, 2)
                            change_1h = diff
                            if diff > 0.05:
                                trend_val = "RISING"
                            elif diff < -0.05:
                                trend_val = "FALLING"
                            else:
                                trend_val = "STABLE"

                        return WaterLevelReading(
                            timestamp=latest_reading.timestamp,
                            data_source=DataSourceInfo(
                                status=status,
                                source=source,
                                source_label=source_label,
                                station_name=w_rec.name,
                                station_distance_km=dist,
                            ),
                            water_level=round(latest_reading.water_level_m, 2),
                            trend=trend_val,
                            daily_variation=0.15,
                            warning_level_m=w_rec.warning_level_m or 7.5,
                            danger_level_m=w_rec.danger_level_m or 8.5,
                            historical_max_m=round((w_rec.danger_level_m or 8.5) + 0.8, 2),
                            change_1h_m=change_1h,
                            nearest_station=w_rec.name,
                            nearest_station_distance_km=dist,
                        )
                finally:
                    session.close()
            except Exception as e:
                print(f"[EnvironmentService Warning] Well reading fetch failed: {e}")

        # Check if an authenticated physical IoT sensor is directly at this location (<1 km)
        from app.providers.sensor_data import SensorDataProvider
        sensor_provider = SensorDataProvider()
        s_res = sensor_provider._resolve_sensor_and_latest(lat, lon)
        if s_res[0] and s_res[2] and s_res[2].source == "IOT_SENSOR":
            return sensor_provider.get_water_level(lat, lon, recent_rainfall)

        # Otherwise route through Station Provider (with proximity thresholds)
        return self.station_provider.get_water_level(lat, lon, recent_rainfall)

    def get_water_quality(
        self, lat: float, lon: float, recent_rainfall: float = 0.0
    ) -> WaterQualityReading:
        # Check if a registered Well is within proximity (<15 km)
        nearby = self.station_service.get_nearby_stations(lat, lon, radius_km=15.0)
        wells = [s for s in nearby if s.type == "WELL"]
        if wells:
            try:
                from app.models.database import SessionLocal, Well, Reading
                from app.schemas.base import DataSourceInfo, DataStatus, DataSource
                session = SessionLocal()
                try:
                    w_rec = session.query(Well).filter(Well.id == wells[0].id).first()
                    latest_reading = (
                        session.query(Reading)
                        .filter(Reading.well_id == wells[0].id)
                        .order_by(Reading.timestamp.desc())
                        .first()
                    )
                    if w_rec and latest_reading:
                        dist = wells[0].distance_km
                        reading_status_val = (
                            latest_reading.status.value
                            if hasattr(latest_reading.status, "value")
                            else str(latest_reading.status)
                        )
                        reading_source_val = (
                            latest_reading.source.value
                            if hasattr(latest_reading.source, "value")
                            else str(latest_reading.source)
                        )

                        if reading_status_val == "SIMULATED" or reading_source_val == "SYNTHETIC":
                            status = DataStatus.SIMULATED
                            source = DataSource.SYNTHETIC
                            source_label = f"{w_rec.name} (Simulated Demo Well Telemetry)"
                        elif reading_status_val == "LIVE":
                            from datetime import datetime, timezone
                            now_utc = datetime.now(timezone.utc)
                            r_ts = latest_reading.timestamp
                            if r_ts.tzinfo is None:
                                r_ts = r_ts.replace(tzinfo=timezone.utc)
                            age_mins = (now_utc - r_ts).total_seconds() / 60.0

                            if age_mins > 1440:
                                status = DataStatus.UNAVAILABLE
                                source_label = f"{w_rec.name} (Physical Sensor Offline - Stale {int(age_mins/60)}h)"
                            elif age_mins > 30 or dist > 1.0:
                                status = DataStatus.ESTIMATED
                                source_label = f"{w_rec.name} (Physical Sensor - Estimated by distance/time)"
                            else:
                                status = DataStatus.LIVE
                                source_label = f"{w_rec.name} (Physical Sonde - Live Telemetry)"
                            source = DataSource.IOT_SENSOR
                        else:
                            status = DataStatus.ESTIMATED
                            source = DataSource.MONITORING_STATION
                            source_label = f"{w_rec.name} ({dist} km away)"

                        cat = WaterQualityReading.compute_category(
                            latest_reading.ph, latest_reading.turbidity_ntu, latest_reading.tds_ppm
                        )
                        return WaterQualityReading(
                            timestamp=latest_reading.timestamp,
                            data_source=DataSourceInfo(
                                status=status,
                                source=source,
                                source_label=source_label,
                                station_name=w_rec.name,
                                station_distance_km=dist,
                            ),
                            ph=round(latest_reading.ph, 2),
                            turbidity=round(latest_reading.turbidity_ntu, 1),
                            tds=round(latest_reading.tds_ppm, 1),
                            temperature=round(latest_reading.temperature_c, 1),
                            dissolved_oxygen=round(latest_reading.dissolved_oxygen_mg_l, 1),
                            electrical_conductivity=round(latest_reading.tds_ppm * 1.56, 1),
                            category=cat,
                        )
                finally:
                    session.close()
            except Exception as e:
                print(f"[EnvironmentService Warning] Well quality reading fetch failed: {e}")

        from app.providers.sensor_data import SensorDataProvider
        sensor_provider = SensorDataProvider()
        s_res = sensor_provider._resolve_sensor_and_latest(lat, lon)
        if s_res[0] and s_res[2] and s_res[2].source == "IOT_SENSOR":
            return sensor_provider.get_water_quality(lat, lon, recent_rainfall)

        return self.station_provider.get_water_quality(lat, lon, recent_rainfall)

    def get_air_quality(
        self, lat: float, lon: float, wind_speed: float = 0.0
    ) -> AirQualityReading:
        return self.station_provider.get_air_quality(lat, lon, wind_speed)

    async def get_full_environment(self, lat: float, lon: float) -> EnvironmentResponse:
        location_coro = self.location_service.reverse_geocode(lat, lon)
        weather_coro = self.get_weather(lat, lon)

        location, weather = await location_coro, await weather_coro

        recent_rainfall = weather.precipitation
        wind_speed = weather.wind_speed_10m

        water_level = self.get_water_level(lat, lon, recent_rainfall)
        water_quality = self.get_water_quality(lat, lon, recent_rainfall)
        air_quality = self.get_air_quality(lat, lon, wind_speed)

        risk = self.risk_service.calculate_risk(
            water_level=water_level.water_level,
            warning_level=water_level.warning_level_m,
            danger_level=water_level.danger_level_m,
            water_quality=water_quality.model_dump(),
            air_quality=air_quality.model_dump(),
            weather=weather.model_dump(),
        )

        return EnvironmentResponse(
            location=location,
            weather=weather,
            water_level=water_level,
            water_quality=water_quality,
            air_quality=air_quality,
            risk=risk,
            timestamp=datetime.utcnow(),
        )
