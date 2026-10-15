import pytest
from datetime import datetime, timedelta, timezone
from math import sin as math_sin
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Well, Reading, LithologyLayer, WaterLevelForecast

client = TestClient(app)


@pytest.fixture(scope="module")
def setup_test_wells():
    """Setup fixture creating wells with different data volumes for rigorous testing."""
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    
    # 1. Well with sufficient data (>50 readings across 3 days)
    well_sufficient = Well(
        id="TEST-WELL-SUFFICIENT",
        name="Test Well With Abundant Telemetry",
        latitude=23.79,
        longitude=86.43,
        country="India",
        state="Jharkhand",
        district="Dhanbad",
        city="Dhanbad",
        warning_level_m=6.5,
        danger_level_m=8.0,
        total_depth_m=45.0,
        monitoring_type="SIMULATED",
        is_active=True,
    )
    db.merge(well_sufficient)

    # Add lithology layers for recharge modeling
    layer1 = LithologyLayer(
        well_id="TEST-WELL-SUFFICIENT",
        from_depth_m=0.0,
        to_depth_m=4.0,
        material_type="sand",
        description="Coarse river sand with high permeability",
        confidence_level="HIGH",
    )
    layer2 = LithologyLayer(
        well_id="TEST-WELL-SUFFICIENT",
        from_depth_m=4.0,
        to_depth_m=18.0,
        material_type="weathered_rock",
        description="Fractured sandstone aquifer",
        confidence_level="HIGH",
    )
    db.add(layer1)
    db.add(layer2)

    # 72 readings spanning 3 days (1 per hour)
    for h in range(72):
        t = now - timedelta(hours=72 - h)
        # slight upward trend + diurnal wave
        osc = 0.15 * math_sin(2 * 3.14159 * h / 24.0)
        wl = 4.2 + (0.005 * h) + osc
        r = Reading(
            well_id="TEST-WELL-SUFFICIENT",
            water_level_m=round(wl, 2),
            ph=7.2,
            tds_ppm=280.0,
            turbidity_ntu=3.5,
            dissolved_oxygen_mg_l=6.8,
            temperature_c=24.5,
            status="SIMULATED",
            source="SYNTHETIC",
            timestamp=t,
        )
        db.add(r)

    # 2. Well with very little data (only 2 readings, < 24 hours)
    well_sparse = Well(
        id="TEST-WELL-SPARSE",
        name="Test Well With Sparse Telemetry",
        latitude=23.80,
        longitude=86.44,
        country="India",
        state="Jharkhand",
        district="Dhanbad",
        city="Dhanbad",
        warning_level_m=6.5,
        danger_level_m=8.0,
        total_depth_m=40.0,
        monitoring_type="SIMULATED",
        is_active=True,
    )
    db.merge(well_sparse)

    db.add(Reading(
        well_id="TEST-WELL-SPARSE",
        water_level_m=3.5,
        ph=7.0,
        tds_ppm=250.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=7.0,
        temperature_c=25.0,
        status="SIMULATED",
        source="SYNTHETIC",
        timestamp=now - timedelta(hours=2),
    ))
    db.add(Reading(
        well_id="TEST-WELL-SPARSE",
        water_level_m=3.52,
        ph=7.0,
        tds_ppm=250.0,
        turbidity_ntu=2.0,
        dissolved_oxygen_mg_l=7.0,
        temperature_c=25.0,
        status="SIMULATED",
        source="SYNTHETIC",
        timestamp=now - timedelta(hours=1),
    ))

    # 3. Well with missing intervals (gaps of 10 hours between observations)
    well_gaps = Well(
        id="TEST-WELL-GAPS",
        name="Test Well With Missing Reading Intervals",
        latitude=23.82,
        longitude=86.45,
        country="India",
        state="Jharkhand",
        district="Dhanbad",
        city="Dhanbad",
        warning_level_m=7.0,
        danger_level_m=8.5,
        total_depth_m=50.0,
        monitoring_type="SIMULATED",
        is_active=True,
    )
    db.merge(well_gaps)

    # 10 readings spaced with 8-hour gaps (spanning 80 hours total)
    for i in range(10):
        t = now - timedelta(hours=(10 - i) * 8)
        db.add(Reading(
            well_id="TEST-WELL-GAPS",
            water_level_m=round(4.0 + (i * 0.03), 2),
            ph=7.1,
            tds_ppm=310.0,
            turbidity_ntu=4.0,
            dissolved_oxygen_mg_l=6.5,
            temperature_c=23.8,
            status="SIMULATED",
            source="SYNTHETIC",
            timestamp=t,
        ))

    # 4. Well with exactly 24 hourly readings (spanning 23 hours delta)
    well_24 = Well(
        id="TEST-WELL-24-HOURLY",
        name="Test Well With Exactly 24 Hourly Readings",
        latitude=23.83,
        longitude=86.46,
        country="India",
        state="Jharkhand",
        district="Dhanbad",
        city="Dhanbad",
        warning_level_m=7.0,
        danger_level_m=8.5,
        total_depth_m=50.0,
        monitoring_type="SIMULATED",
        is_active=True,
    )
    db.merge(well_24)
    for h in range(24):
        t = now - timedelta(hours=23 - h)
        db.add(Reading(
            well_id="TEST-WELL-24-HOURLY",
            water_level_m=round(5.0 + 0.1 * math_sin(2 * 3.14159 * h / 24.0), 2),
            ph=7.0,
            tds_ppm=260.0,
            turbidity_ntu=2.5,
            dissolved_oxygen_mg_l=6.9,
            temperature_c=24.0,
            status="SIMULATED",
            source="SYNTHETIC",
            timestamp=t,
        ))

    # 5. Well with 500 daily readings to verify no 250 truncation
    well_multi = Well(
        id="TEST-WELL-MULTI-YEAR",
        name="Test Well With 500 Historical Readings",
        latitude=23.84,
        longitude=86.47,
        country="India",
        state="Jharkhand",
        district="Dhanbad",
        city="Dhanbad",
        warning_level_m=7.0,
        danger_level_m=8.5,
        total_depth_m=50.0,
        monitoring_type="SIMULATED",
        is_active=True,
    )
    db.merge(well_multi)
    for d in range(500):
        t = now - timedelta(days=499 - d)
        db.add(Reading(
            well_id="TEST-WELL-MULTI-YEAR",
            water_level_m=round(5.5 + 0.5 * math_sin(2 * 3.14159 * d / 365.25), 2),
            ph=7.2,
            tds_ppm=290.0,
            turbidity_ntu=3.0,
            dissolved_oxygen_mg_l=6.5,
            temperature_c=25.0,
            status="SIMULATED",
            source="SYNTHETIC",
            timestamp=t,
        ))

    db.commit()
    db.close()

    yield

    # Cleanup test wells
    db = SessionLocal()
    for wid in ["TEST-WELL-SUFFICIENT", "TEST-WELL-SPARSE", "TEST-WELL-GAPS", "TEST-WELL-24-HOURLY", "TEST-WELL-MULTI-YEAR"]:
        db.query(Reading).filter(Reading.well_id == wid).delete()
        db.query(LithologyLayer).filter(LithologyLayer.well_id == wid).delete()
        db.query(WaterLevelForecast).filter(WaterLevelForecast.well_id == wid).delete()
        db.query(Well).filter(Well.id == wid).delete()
    db.commit()
    db.close()


def math_sin(x):
    import math
    return math.sin(x)


def test_forecast_sufficient_data_7_and_15_days(setup_test_wells):
    """Test 1: A well with sufficient historical data supports both 7-day and 15-day forecasts."""
    # 7-day forecast
    resp7 = client.get("/api/wells/TEST-WELL-SUFFICIENT/forecast?horizon=7&include_backtest=true")
    assert resp7.status_code == 200
    data7 = resp7.json()
    assert data7["status"] == "SUCCESS"
    assert data7["horizon_days"] == 7
    assert len(data7["predictions"]) == 7
    assert data7["is_demo"] is True
    assert data7["forecast_type"] == "DEMO_SIMULATED"
    assert "disclaimer" in data7

    # Verify each prediction contains confidence intervals and breakdown
    for p in data7["predictions"]:
        assert "timestamp" in p
        assert "estimated_water_level_m" in p
        assert p["confidence_lower"] <= p["estimated_water_level_m"] <= p["confidence_upper"]
        assert "expected_rainfall_mm" in p
        assert "trend_component_m" in p
        assert "recharge_component_m" in p

    # Verify backtest metrics
    assert data7["backtest"] is not None
    assert data7["backtest"]["status"] == "VALIDATED"
    assert isinstance(data7["backtest"]["mae"], float)
    assert isinstance(data7["backtest"]["rmse"], float)
    assert data7["backtest"]["test_samples"] > 0
    assert len(data7["backtest"]["limitations"]) > 0

    # 15-day forecast
    resp15 = client.get("/api/wells/TEST-WELL-SUFFICIENT/forecast?horizon=15")
    assert resp15.status_code == 200
    data15 = resp15.json()
    assert data15["status"] == "SUCCESS"
    assert data15["horizon_days"] == 15
    assert len(data15["predictions"]) == 15


def test_forecast_insufficient_data(setup_test_wells):
    """Test 2: A well with very little data returns explicit INSUFFICIENT_DATA and zero fake predictions."""
    resp = client.get("/api/wells/TEST-WELL-SPARSE/forecast?horizon=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "INSUFFICIENT_DATA"
    assert "reason" in data
    assert "A minimum of 5" in data["reason"] or "spans only" in data["reason"]
    assert len(data["predictions"]) == 0
    assert data["backtest"] is None


def test_forecast_missing_readings_robustness(setup_test_wells):
    """Test 3: A well with missing reading intervals produces a safe forecast without crashing."""
    resp = client.get("/api/wells/TEST-WELL-GAPS/forecast?horizon=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert len(data["predictions"]) == 7
    assert data["environmental_drivers"]["baseline_water_level_m"] > 0.0


def test_forecast_simulated_data_labeling(setup_test_wells):
    """Test 4: Predictions derived from simulated readings are clearly labeled DEMO/SIMULATED."""
    resp = client.get("/api/wells/TEST-WELL-SUFFICIENT/forecast")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_demo"] is True
    assert data["forecast_type"] == "DEMO_SIMULATED"
    assert "simulated" in data["disclaimer"].lower() or "demonstration" in data["disclaimer"].lower()


def test_forecast_nonexistent_well():
    """Test 5: A request for a well that does not exist returns 404."""
    resp = client.get("/api/wells/NON-EXISTENT-WELL-9999/forecast")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_forecast_persistence_and_history(setup_test_wells):
    """Test 6: Forecast persistence stores records in water_level_forecasts without touching readings table."""
    db = SessionLocal()
    readings_count_before = db.query(Reading).filter(Reading.well_id == "TEST-WELL-SUFFICIENT").count()
    db.close()

    # Call with persist=true
    resp = client.get("/api/wells/TEST-WELL-SUFFICIENT/forecast?horizon=7&persist=true")
    assert resp.status_code == 200
    data = resp.json()
    assert "persisted_forecast_id" in data
    forecast_id = data["persisted_forecast_id"]
    assert forecast_id is not None

    # Verify observed readings table was NOT touched
    db = SessionLocal()
    readings_count_after = db.query(Reading).filter(Reading.well_id == "TEST-WELL-SUFFICIENT").count()
    assert readings_count_after == readings_count_before

    # Verify forecast is in water_level_forecasts table
    saved = db.query(WaterLevelForecast).filter(WaterLevelForecast.id == forecast_id).first()
    assert saved is not None
    assert saved.well_id == "TEST-WELL-SUFFICIENT"
    assert len(saved.predictions) == 7
    db.close()

    # Query history endpoint
    resp_hist = client.get("/api/wells/TEST-WELL-SUFFICIENT/forecast/history")
    assert resp_hist.status_code == 200
    hist = resp_hist.json()
    assert len(hist) >= 1
    assert hist[0]["id"] == forecast_id


def test_forecast_24_hourly_readings_qualification(setup_test_wells):
    """Test 7: Exactly 24 hourly readings spanning 23 hours delta qualifies for 7-day forecast."""
    resp = client.get("/api/wells/TEST-WELL-24-HOURLY/forecast?horizon=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS", f"Expected SUCCESS but got {data.get('reason')}"
    assert data["horizon_days"] == 7
    assert len(data["predictions"]) == 7
    assert data["data_freshness"]["observations_count"] == 24
    assert data["data_freshness"]["data_span_days"] >= 0.95


def test_forecast_multi_year_history_no_250_cap(setup_test_wells):
    """Test 8: Wells with >250 historical readings are not truncated to 250 samples."""
    resp = client.get("/api/wells/TEST-WELL-MULTI-YEAR/forecast?horizon=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert data["data_freshness"]["observations_count"] == 500
    assert data["data_freshness"]["data_span_days"] >= 498.0

