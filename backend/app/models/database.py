import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Boolean, DateTime,
    ForeignKey, Text, Enum, JSON, Index, create_engine
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class DataStatusEnum(str, enum.Enum):
    LIVE = "LIVE"
    ESTIMATED = "ESTIMATED"
    SIMULATED = "SIMULATED"
    UNAVAILABLE = "UNAVAILABLE"


class DataSourceEnum(str, enum.Enum):
    MONITORING_STATION = "MONITORING_STATION"
    IOT_SENSOR = "IOT_SENSOR"
    WEATHER_API = "WEATHER_API"
    SYNTHETIC = "SYNTHETIC"


class StationTypeEnum(str, enum.Enum):
    WATER = "WATER"
    AIR = "AIR"
    IOT = "IOT"


class UserRoleEnum(str, enum.Enum):
    MAIN_ADMIN = "MAIN_ADMIN"
    SUBADMIN = "SUBADMIN"


# 1. users
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), default="SUBADMIN", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wells = relationship("Well", back_populates="creator")


# 2. locations
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), default="India")
    river_basin = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# 3. data_sources
class DataSourceRecord(Base):
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    source_type = Column(Enum(DataSourceEnum), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 4. monitoring_stations
class MonitoringStationRecord(Base):
    __tablename__ = "monitoring_stations"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    station_type = Column(Enum(StationTypeEnum), nullable=False)
    water_body = Column(String(100), nullable=True)
    warning_level_m = Column(Float, nullable=True)
    danger_level_m = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# 5. iot_sensors
class IoTSensorRecord(Base):
    __tablename__ = "iot_sensors"

    id = Column(String(50), primary_key=True, index=True)  # e.g., "ST001"
    station_id = Column(String(50), ForeignKey("monitoring_stations.id"), nullable=True)
    sensor_type = Column(String(100), nullable=False)  # pH, TDS, Turbidity, Ultrasonic
    device_model = Column(String(100), default="ESP32-Node")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_online = Column(Boolean, default=True)
    last_ping = Column(DateTime, default=datetime.utcnow)


# 6. water_measurements
class WaterMeasurement(Base):
    __tablename__ = "water_measurements"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(50), ForeignKey("monitoring_stations.id"), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    water_level_m = Column(Float, nullable=False)
    flow_rate_cumecs = Column(Float, nullable=True)
    trend = Column(String(20), default="STABLE")
    change_1h_m = Column(Float, nullable=True)
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.SIMULATED)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.SYNTHETIC)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 7. water_quality_measurements
class WaterQualityMeasurement(Base):
    __tablename__ = "water_quality_measurements"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(50), ForeignKey("monitoring_stations.id"), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    tds_ppm = Column(Float, nullable=False)
    turbidity_ntu = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    dissolved_oxygen_mg_l = Column(Float, nullable=False)
    electrical_conductivity_us_cm = Column(Float, nullable=True)
    category = Column(String(20), default="GOOD")
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.SIMULATED)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.SYNTHETIC)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 8. weather_measurements
class WeatherMeasurement(Base):
    __tablename__ = "weather_measurements"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    apparent_temperature_c = Column(Float, nullable=True)
    relative_humidity_pct = Column(Float, nullable=False)
    precipitation_mm = Column(Float, default=0.0)
    wind_speed_kmh = Column(Float, default=0.0)
    wind_direction_deg = Column(Float, default=0.0)
    surface_pressure_hpa = Column(Float, default=1013.0)
    uv_index = Column(Float, default=0.0)
    weather_code = Column(Integer, default=0)
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.LIVE)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.WEATHER_API)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 9. air_quality_measurements
class AirQualityMeasurement(Base):
    __tablename__ = "air_quality_measurements"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(50), ForeignKey("monitoring_stations.id"), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    aqi = Column(Float, nullable=False)
    pm25 = Column(Float, nullable=False)
    pm10 = Column(Float, nullable=False)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    co = Column(Float, nullable=True)
    category = Column(String(50), default="Moderate")
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.SIMULATED)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.SYNTHETIC)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 10. sensor_measurements (raw telemetry from IoT sensors/ESP32)
class SensorMeasurement(Base):
    __tablename__ = "sensor_measurements"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String(50), ForeignKey("iot_sensors.id"), index=True, nullable=False)
    metric = Column(String(50), nullable=False)  # ph, tds, water_level, turbidity
    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.LIVE)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.IOT_SENSOR)
    raw_payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 11. risk_analysis
class RiskAnalysis(Base):
    __tablename__ = "risk_analysis"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    overall_score = Column(Float, nullable=False)
    overall_level = Column(String(20), nullable=False)  # LOW, MODERATE, HIGH, CRITICAL
    flood_risk_score = Column(Float, nullable=True)
    water_quality_risk_score = Column(Float, nullable=True)
    air_quality_risk_score = Column(Float, nullable=True)
    extreme_weather_risk_score = Column(Float, nullable=True)
    factors_summary = Column(JSON, nullable=True)
    algorithm_version = Column(String(50), default="RuleEngine-v1")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


# 12. wells
class Well(Base):
    __tablename__ = "wells"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    country = Column(String(100), default="India", index=True, nullable=True)
    state = Column(String(100), index=True, nullable=True)
    district = Column(String(100), index=True, nullable=True)
    city = Column(String(100), index=True, nullable=True)
    location_description = Column(String(255), nullable=True)
    warning_level_m = Column(Float, default=7.5)
    danger_level_m = Column(Float, default=8.5)
    total_depth_m = Column(Float, nullable=True)
    monitoring_type = Column(String(50), default="SIMULATED", nullable=True, index=True)  # SIMULATED, PHYSICAL_SENSOR, MANUAL
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    creator = relationship("User", back_populates="wells")
    sensors = relationship("Sensor", back_populates="well", cascade="all, delete-orphan")
    readings = relationship("Reading", back_populates="well", cascade="all, delete-orphan")
    lithology_layers = relationship(
        "LithologyLayer",
        back_populates="well",
        cascade="all, delete-orphan",
        order_by="LithologyLayer.from_depth_m",
    )


# 13. sensors
class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(String(50), primary_key=True, index=True)
    well_id = Column(String(50), ForeignKey("wells.id"), nullable=False, index=True)
    sensor_type = Column(String(100), nullable=False)  # Multi-parameter, Ultrasonic Water Level, Water Quality Probe, etc.
    model = Column(String(100), default="AquaSense-Probe-v1")
    measurement_parameter = Column(String(255), default="water_level,ph,tds,turbidity,dissolved_oxygen,temperature")
    units = Column(String(100), default="m,pH,ppm,NTU,mg/L,°C")
    is_installed = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    api_key_hash = Column(String(255), nullable=True)
    data_source = Column(String(50), default="IOT_SENSOR")
    last_seen_at = Column(DateTime, nullable=True)
    installed_at = Column(DateTime, default=datetime.utcnow)

    well = relationship("Well", back_populates="sensors")
    readings = relationship("Reading", back_populates="sensor")


# 14. readings
class Reading(Base):
    __tablename__ = "readings"
    __table_args__ = (
        Index("idx_readings_well_timestamp", "well_id", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    well_id = Column(String(50), ForeignKey("wells.id"), nullable=False, index=True)
    sensor_id = Column(String(50), ForeignKey("sensors.id"), nullable=True, index=True)
    water_level_m = Column(Float, nullable=False)
    ph = Column(Float, nullable=False)
    tds_ppm = Column(Float, nullable=False)
    turbidity_ntu = Column(Float, nullable=False)
    dissolved_oxygen_mg_l = Column(Float, nullable=False)
    temperature_c = Column(Float, nullable=False)
    status = Column(Enum(DataStatusEnum), default=DataStatusEnum.SIMULATED)
    source = Column(Enum(DataSourceEnum), default=DataSourceEnum.SYNTHETIC)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    well = relationship("Well", back_populates="readings")
    sensor = relationship("Sensor", back_populates="readings")


# 15. lithology_layers (subsurface geological logging & stratigraphy)
class LithologyLayer(Base):
    __tablename__ = "lithology_layers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    well_id = Column(String(50), ForeignKey("wells.id", ondelete="CASCADE"), nullable=False, index=True)
    from_depth_m = Column(Float, nullable=False, index=True)
    to_depth_m = Column(Float, nullable=False, index=True)
    material_type = Column(String(50), nullable=False, index=True)  # topsoil, clay, sand, gravel, silt, sandstone, limestone, granite, weathered_rock, fractured_rock, other
    description = Column(Text, nullable=True)
    color_code = Column(String(20), nullable=True)
    observed_properties = Column(JSON, nullable=True)
    data_source = Column(String(50), default="CORE_SAMPLE", nullable=False)  # CORE_SAMPLE, DRILL_CUTTINGS, GEOPHYSICAL_LOG, HISTORICAL_RECORD, illustrative_demo
    confidence_level = Column(String(20), default="HIGH", nullable=False)  # HIGH, MEDIUM, LOW
    aquifer_indicator = Column(Boolean, default=False, nullable=True)
    source_reference = Column(String(255), nullable=True)
    attachment_url = Column(String(500), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    well = relationship("Well", back_populates="lithology_layers")
    creator = relationship("User", foreign_keys=[created_by_user_id])
    updater = relationship("User", foreign_keys=[updated_by_user_id])


# Database Engine and Session Factory
DATABASE_URL = "sqlite:///./aquasense.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            # 1. Migrate sensors table columns
            sensor_cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info(sensors)").fetchall()]
            new_sensor_cols = [
                ("measurement_parameter", "VARCHAR(255) DEFAULT 'water_level,ph,tds,turbidity,dissolved_oxygen,temperature'"),
                ("units", "VARCHAR(100) DEFAULT 'm,pH,ppm,NTU,mg/L,°C'"),
                ("is_installed", "BOOLEAN DEFAULT 1"),
                ("api_key_hash", "VARCHAR(255) NULL"),
                ("data_source", "VARCHAR(50) DEFAULT 'IOT_SENSOR'"),
                ("last_seen_at", "DATETIME NULL"),
            ]
            for col_name, col_def in new_sensor_cols:
                if col_name not in sensor_cols:
                    conn.exec_driver_sql(f"ALTER TABLE sensors ADD COLUMN {col_name} {col_def}")

            # 2. Migrate wells table columns (country, state, district, city, created_by, total_depth_m)
            well_cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info(wells)").fetchall()]
            new_well_cols = [
                ("country", "VARCHAR(100) DEFAULT 'India'"),
                ("state", "VARCHAR(100) NULL"),
                ("district", "VARCHAR(100) NULL"),
                ("city", "VARCHAR(100) NULL"),
                ("created_by", "INTEGER NULL REFERENCES users(id)"),
                ("total_depth_m", "FLOAT NULL"),
                ("monitoring_type", "VARCHAR(50) DEFAULT 'SIMULATED'"),
            ]
            for col_name, col_def in new_well_cols:
                if col_name not in well_cols:
                    conn.exec_driver_sql(f"ALTER TABLE wells ADD COLUMN {col_name} {col_def}")

            # 3. Create performance indexes for time-series querying and scheduler filtering
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_readings_well_timestamp ON readings(well_id, timestamp)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_wells_active_monitoring ON wells(is_active, monitoring_type)")

            # 4. Migrate users table columns (role)
            user_cols = [c[1] for c in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()]
            if "role" not in user_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'SUBADMIN'")

            # Ensure initial admin user has MAIN_ADMIN role
            conn.exec_driver_sql("UPDATE users SET role = 'MAIN_ADMIN' WHERE username = 'admin' OR id = 1")

            # Backfill existing wells without a creator to the main admin user
            conn.exec_driver_sql(
                "UPDATE wells SET created_by = (SELECT id FROM users WHERE role = 'MAIN_ADMIN' OR username = 'admin' ORDER BY id ASC LIMIT 1) WHERE created_by IS NULL"
            )

            conn.commit()

        # 3. Backfill and normalize geographic metadata on all existing wells
        backfill_and_normalize_well_geo()
    except Exception as e:
        print(f"[DB Migration Warning] Column migration notice: {e}")


def backfill_and_normalize_well_geo():
    """
    Ensure all existing wells have valid, normalized geographic metadata:
    - Normalizes abbreviations (e.g. UP -> Uttar Pradesh)
    - Resolves missing country, state, district, or city using coordinates and name clues
    - Preserves deterministic location hierarchy across refreshes
    """
    from app.services.geo_service import GeoService, normalize_location_name
    geo_svc = GeoService()
    session = SessionLocal()
    try:
        wells = session.query(Well).all()
        updated = False
        for w in wells:
            # 1. Resolve missing fields using coordinates
            if not w.country or not w.state or not w.district or not w.city:
                resolved = geo_svc.resolve_hierarchy_by_coordinates(w.latitude, w.longitude)
                name_lower = (w.name or "").lower()
                desc_lower = (w.location_description or "").lower()

                if not w.country:
                    w.country = resolved.get("country") or "India"
                    updated = True
                if not w.state:
                    state_res = resolved.get("state")
                    if not state_res and ("lucknow" in name_lower or "lucknow" in desc_lower or "uttar pradesh" in desc_lower or "up" in desc_lower):
                        state_res = "Uttar Pradesh"
                    if state_res:
                        w.state = state_res
                        updated = True
                if not w.district:
                    dist_res = resolved.get("district")
                    if not dist_res and ("lucknow" in name_lower or "lucknow" in desc_lower):
                        dist_res = "Lucknow"
                    if dist_res:
                        w.district = dist_res
                        updated = True
                if not w.city:
                    city_res = resolved.get("city")
                    if not city_res and ("lucknow" in name_lower or "lucknow" in desc_lower):
                        city_res = "Lucknow"
                    if city_res:
                        w.city = city_res
                        updated = True

            # 2. Normalize existing fields (e.g. "UP" -> "Uttar Pradesh", trimming whitespace)
            if w.country:
                norm_country = normalize_location_name(w.country)
                if norm_country and norm_country != w.country:
                    w.country = norm_country
                    updated = True
            if w.state:
                norm_state = normalize_location_name(w.state)
                if norm_state and norm_state != w.state:
                    w.state = norm_state
                    updated = True
            if w.district:
                norm_district = normalize_location_name(w.district)
                if norm_district and norm_district != w.district:
                    w.district = norm_district
                    updated = True
            if w.city:
                norm_city = normalize_location_name(w.city)
                if norm_city and norm_city != w.city:
                    w.city = norm_city
                    updated = True

        if updated:
            session.commit()
    except Exception as e:
        session.rollback()
        print(f"[DB Geo Normalization Notice] {e}")
    finally:
        session.close()
