import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import (
    SessionLocal,
    Well,
    Reading,
    DataStatusEnum,
    DataSourceEnum,
    User,
    UserRoleEnum,
)
from app.services.historical_simulation_service import HistoricalSimulationService
from app.services.well_history_service import WellHistoryService
from app.services.forecasting_service import GroundwaterForecastingService
from app.auth import create_session_token

client = TestClient(app)

TEST_SIM_WELL_ID = "TEST-SIM-3Y-01"
TEST_PHYS_WELL_ID = "TEST-PHYS-3Y-01"
TEST_MAN_WELL_ID = "TEST-MAN-3Y-01"


@pytest.fixture(scope="module", autouse=True)
def setup_teardown_test_environment():
    """Ensure clean database state before and after 3-year history tests."""
    db = SessionLocal()
    test_well_ids = [TEST_SIM_WELL_ID, TEST_PHYS_WELL_ID, TEST_MAN_WELL_ID]
    try:
        # Cleanup any lingering test data
        db.query(Reading).filter(Reading.well_id.in_(test_well_ids)).delete(synchronize_session=False)
        db.query(Well).filter(Well.id.in_(test_well_ids)).delete(synchronize_session=False)
        db.commit()

        # Create simulated demo well
        sim_well = Well(
            id=TEST_SIM_WELL_ID,
            name="Demo Aquifer Observatory 01",
            latitude=23.795,
            longitude=86.430,
            country="India",
            state="Jharkhand",
            district="Dhanbad",
            city="Dhanbad",
            warning_level_m=6.5,
            danger_level_m=8.5,
            total_depth_m=60.0,
            monitoring_type="SIMULATED",
            is_active=True,
        )

        # Create physical sensor well
        phys_well = Well(
            id=TEST_PHYS_WELL_ID,
            name="Physical IoT Telemetry Well",
            latitude=23.810,
            longitude=86.440,
            country="India",
            state="Jharkhand",
            district="Dhanbad",
            city="Govindpur",
            warning_level_m=5.5,
            danger_level_m=7.5,
            total_depth_m=50.0,
            monitoring_type="PHYSICAL_SENSOR",
            is_active=True,
        )

        # Create manual well
        man_well = Well(
            id=TEST_MAN_WELL_ID,
            name="Manual Dipmeter Well",
            latitude=23.820,
            longitude=86.450,
            country="India",
            state="Jharkhand",
            district="Dhanbad",
            city="Nirsa",
            warning_level_m=6.0,
            danger_level_m=8.0,
            total_depth_m=40.0,
            monitoring_type="MANUAL",
            is_active=True,
        )

        db.add_all([sim_well, phys_well, man_well])
        db.commit()

        # Seed admin user if not exists
        admin = db.query(User).filter(User.username == "admin_3y_test").first()
        if not admin:
            admin = User(
                username="admin_3y_test",
                email="admin3y@aquasense.io",
                hashed_password="fakehashedpassword",
                role=UserRoleEnum.MAIN_ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()

        yield

    finally:
        db.query(Reading).filter(Reading.well_id.in_(test_well_ids)).delete(synchronize_session=False)
        db.query(Well).filter(Well.id.in_(test_well_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.username == "admin_3y_test").delete(synchronize_session=False)
        db.commit()
        db.close()


def test_01_backfill_well_history_creation_and_provenance():
    """Verify that backfill generates ~3 years of plausible, labeled simulated readings."""
    result = HistoricalSimulationService.backfill_well_history(TEST_SIM_WELL_ID, span_days=1095)
    
    assert result["status"] == "COMPLETED"
    assert result["readings_created"] >= 1000  # Should be ~1080 daily + 336 hourly = ~1417
    assert result["well_id"] == TEST_SIM_WELL_ID

    db = SessionLocal()
    try:
        readings = (
            db.query(Reading)
            .filter(Reading.well_id == TEST_SIM_WELL_ID)
            .order_by(Reading.timestamp.asc())
            .all()
        )
        assert len(readings) == result["readings_created"]

        earliest = readings[0].timestamp
        latest = readings[-1].timestamp
        if earliest.tzinfo is None:
            earliest = earliest.replace(tzinfo=timezone.utc)
        if latest.tzinfo is None:
            latest = latest.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        time_span = (latest - earliest).total_seconds() / 86400.0
        assert time_span >= 1085, f"Span should be at least ~1085 days, got {time_span}"
        assert (now - earliest).total_seconds() / 86400.0 >= 1090

        # Verify strict provenance labels on all generated records
        for r in readings:
            assert r.status == DataStatusEnum.SIMULATED
            assert r.source == DataSourceEnum.SYNTHETIC
            assert 0.5 <= r.water_level_m <= 15.0
            assert 6.0 <= r.ph <= 8.5
            assert 100.0 <= r.tds_ppm <= 800.0
            assert 0.5 <= r.turbidity_ntu <= 25.0
            assert 3.0 <= r.dissolved_oxygen_mg_l <= 10.0
            assert 15.0 <= r.temperature_c <= 35.0
    finally:
        db.close()


def test_02_backfill_idempotency_duplicate_prevention():
    """Verify running backfill a second time generates ZERO duplicate rows."""
    db = SessionLocal()
    try:
        count_before = db.query(Reading).filter(Reading.well_id == TEST_SIM_WELL_ID).count()
        assert count_before > 1000

        # Execute backfill again
        second_result = HistoricalSimulationService.backfill_well_history(TEST_SIM_WELL_ID, span_days=1095)
        assert second_result["readings_created"] == 0
        assert second_result["status"] in ("UP_TO_DATE", "COMPLETED")

        count_after = db.query(Reading).filter(Reading.well_id == TEST_SIM_WELL_ID).count()
        assert count_after == count_before, "No duplicate records may be inserted"
    finally:
        db.close()


def test_03_backfill_strictly_skips_physical_and_manual_wells():
    """Verify backfill strictly refuses to generate synthetic records for PHYSICAL_SENSOR and MANUAL wells."""
    db = SessionLocal()
    try:
        # Physical well
        res_phys = HistoricalSimulationService.backfill_well_history(TEST_PHYS_WELL_ID, span_days=1095)
        assert res_phys["status"] == "SKIPPED_INELIGIBLE"
        assert res_phys["readings_created"] == 0

        # Manual well
        res_man = HistoricalSimulationService.backfill_well_history(TEST_MAN_WELL_ID, span_days=1095)
        assert res_man["status"] == "SKIPPED_INELIGIBLE"
        assert res_man["readings_created"] == 0

        # Verify zero readings inserted
        phys_readings = db.query(Reading).filter(Reading.well_id == TEST_PHYS_WELL_ID).count()
        man_readings = db.query(Reading).filter(Reading.well_id == TEST_MAN_WELL_ID).count()
        assert phys_readings == 0
        assert man_readings == 0
    finally:
        db.close()


def test_04_well_history_service_multi_year_ranges_and_provenance():
    """Verify WellHistoryService correctly serves 1Y, 2Y, 3Y, and custom ranges with provenance flags."""
    # 1 Year query
    h_1y = WellHistoryService.get_historical_analysis(TEST_SIM_WELL_ID, range_type="1y")
    assert h_1y["selected_range"] == "1y"
    assert h_1y["is_demo_history"] is True
    assert h_1y["simulated_percentage"] >= 99.0
    assert "DEMO / SIMULATED" in h_1y["provenance_notice"]
    assert len(h_1y["readings"]) >= 350

    # 2 Year query
    h_2y = WellHistoryService.get_historical_analysis(TEST_SIM_WELL_ID, range_type="2y")
    assert h_2y["selected_range"] == "2y"
    assert h_2y["is_demo_history"] is True
    assert len(h_2y["readings"]) >= 700

    # 3 Year query - must return full 3 years without truncation
    h_3y = WellHistoryService.get_historical_analysis(TEST_SIM_WELL_ID, range_type="3y")
    assert h_3y["selected_range"] == "3y"
    assert h_3y["is_demo_history"] is True
    assert len(h_3y["readings"]) >= 1050, f"Expected >=1050 daily samples, got {len(h_3y['readings'])}"

    # Custom range query
    now = datetime.now(timezone.utc)
    start_dt = now - timedelta(days=200)
    end_dt = now
    h_custom = WellHistoryService.get_historical_analysis(
        TEST_SIM_WELL_ID,
        range_type="custom",
        start_date=start_dt,
        end_date=end_dt,
    )
    assert h_custom["selected_range"] == "custom"
    assert len(h_custom["readings"]) >= 180


def test_05_forecasting_on_simulated_data_labeled_demo():
    """Verify forecasting on simulated history produces DEMO FORECAST — BASED ON SIMULATED DATA."""
    service = GroundwaterForecastingService()
    forecast = service.generate_forecast(TEST_SIM_WELL_ID, horizon_days=7, include_backtest=True)

    assert forecast["status"] == "SUCCESS"
    assert forecast["is_demo"] is True
    assert forecast["forecast_type"] == "DEMO_SIMULATED"
    assert forecast["forecast_label"] == "DEMO FORECAST — BASED ON SIMULATED DATA"
    assert "Simulation Engine" in (forecast.get("data_source_label") or "")
    assert len(forecast["predictions"]) == 7

    # Verify backtest was conducted chronologically
    assert forecast.get("backtest") is not None
    assert forecast["backtest"]["train_samples"] > 0
    assert forecast["backtest"]["test_samples"] > 0


def test_06_forecasting_on_physical_sensor_data_strictly_isolated():
    """Verify forecasting strictly isolates physical sensor readings and does not label them as demo."""
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        # Insert 60 hours of real physical sensor readings
        for h in range(60):
            t = now - timedelta(hours=60 - h)
            r = Reading(
                well_id=TEST_PHYS_WELL_ID,
                sensor_id="IOT-PROBE-01",
                timestamp=t,
                water_level_m=4.5 + (0.01 * (h % 5)),
                ph=7.2,
                tds_ppm=310.0,
                turbidity_ntu=2.1,
                dissolved_oxygen_mg_l=6.5,
                temperature_c=24.5,
                status=DataStatusEnum.LIVE,
                source=DataSourceEnum.IOT_SENSOR,
            )
            db.add(r)
        db.commit()

        service = GroundwaterForecastingService()
        forecast = service.generate_forecast(TEST_PHYS_WELL_ID, horizon_days=7)
        assert forecast["status"] == "SUCCESS"
        assert forecast["is_demo"] is False
        assert forecast["forecast_type"] == "PHYSICAL_TELEMETRY"
        assert forecast["forecast_label"] == "PHYSICAL SENSOR TELEMETRY FORECAST"
        assert "Installed Physical IoT Sensors" in (forecast.get("data_source_label") or "")
    finally:
        db.close()


def test_07_api_scheduler_backfill_endpoint():
    """Verify admin API endpoint POST /api/scheduler/backfill initiates backfill successfully."""
    # Obtain admin token
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin_3y_test").first()
        token = create_session_token(admin.username)
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {token}"}
    
    # Call backfill endpoint for specific well
    res = client.post(
        f"/api/scheduler/backfill?well_id={TEST_SIM_WELL_ID}&years=3",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert data["summary"]["well_id"] == TEST_SIM_WELL_ID
    assert data["summary"]["status"] in ("COMPLETED", "UP_TO_DATE")
