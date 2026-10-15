import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Well, Sensor, Reading, DataStatusEnum, DataSourceEnum
from app.services.scheduler_service import SimulationScheduler, simulation_scheduler
from app.services.well_history_service import WellHistoryService

client = TestClient(app)


def test_scheduler_status_endpoint():
    """Verify /api/scheduler/status returns operational status."""
    res = client.get("/api/scheduler/status")
    assert res.status_code == 200
    data = res.json()
    assert "is_running" in data
    assert "interval_seconds" in data
    assert data["interval_seconds"] >= 5


def test_scheduler_eligibility_policy():
    """Requirement 5: Only wells configured for simulated monitoring receive synthetic readings."""
    s = SessionLocal()
    try:
        # 1. Clean previous test wells if any
        s.query(Reading).filter(Reading.well_id.in_(["TEST-SIM-W1", "TEST-MAN-W1", "TEST-PHYS-W1"])).delete()
        s.query(Well).filter(Well.id.in_(["TEST-SIM-W1", "TEST-MAN-W1", "TEST-PHYS-W1"])).delete()
        s.commit()

        # Simulated well
        w_sim = Well(id="TEST-SIM-W1", name="Sim Well", latitude=23.0, longitude=85.0, monitoring_type="SIMULATED", is_active=True)
        # Manual well
        w_man = Well(id="TEST-MAN-W1", name="Manual Well", latitude=23.1, longitude=85.1, monitoring_type="MANUAL", is_active=True)
        # Physical well
        w_phys = Well(id="TEST-PHYS-W1", name="Phys Well", latitude=23.2, longitude=85.2, monitoring_type="PHYSICAL_SENSOR", is_active=True)
        s.add_all([w_sim, w_man, w_phys])
        s.commit()

        assert SimulationScheduler.is_well_eligible_for_simulation(w_sim, s) is True
        assert SimulationScheduler.is_well_eligible_for_simulation(w_man, s) is False
        assert SimulationScheduler.is_well_eligible_for_simulation(w_phys, s) is False

        # Inactive simulated well must be rejected
        w_sim.is_active = False
        s.commit()
        assert SimulationScheduler.is_well_eligible_for_simulation(w_sim, s) is False
    finally:
        s.query(Reading).filter(Reading.well_id.in_(["TEST-SIM-W1", "TEST-MAN-W1", "TEST-PHYS-W1"])).delete()
        s.query(Well).filter(Well.id.in_(["TEST-SIM-W1", "TEST-MAN-W1", "TEST-PHYS-W1"])).delete()
        s.commit()
        s.close()


def test_scheduler_cycle_deduplication():
    """Requirement 7: Avoid duplicate readings caused by retries or fast triggers."""
    s = SessionLocal()
    try:
        s.query(Reading).filter(Reading.well_id == "TEST-DEDUP-W1").delete()
        s.query(Well).filter(Well.id == "TEST-DEDUP-W1").delete()
        s.commit()

        well = Well(id="TEST-DEDUP-W1", name="Dedup Well", latitude=22.8, longitude=86.2, monitoring_type="SIMULATED", is_active=True)
        s.add(well)
        s.commit()

        # Cycle 1: Generates reading
        res1 = simulation_scheduler.generate_simulated_readings_cycle(s, force_wells=["TEST-DEDUP-W1"])
        assert res1["readings_created"] == 1
        assert res1["skipped_dedup"] == 0

        # Cycle 2 immediate retry: Dedup must skip
        res2 = simulation_scheduler.generate_simulated_readings_cycle(s, force_wells=["TEST-DEDUP-W1"])
        assert res2["readings_created"] == 0
        assert res2["skipped_dedup"] == 1

        # Check stored reading labels
        latest = s.query(Reading).filter(Reading.well_id == "TEST-DEDUP-W1").first()
        assert latest.status == DataStatusEnum.SIMULATED
        assert latest.source == DataSourceEnum.SYNTHETIC
    finally:
        s.query(Reading).filter(Reading.well_id == "TEST-DEDUP-W1").delete()
        s.query(Well).filter(Well.id == "TEST-DEDUP-W1").delete()
        s.commit()
        s.close()


def test_historical_analysis_ranges_and_gaps():
    """Task 2: Historical analysis supporting 1Y, 2Y, 3Y, zero fabrication, and gap reporting."""
    res = client.get("/api/wells/WELL-NIT-01/history-analysis?range=1y")
    assert res.status_code == 200
    data = res.json()
    assert data["well_id"] == "WELL-NIT-01"
    assert data["selected_range"] == "1y"
    assert data["aggregation"] == "day"
    assert data["has_missing_data"] is True
    assert len(data["missing_periods"]) > 0

    # Test 2Y and 3Y
    res_2y = client.get("/api/wells/WELL-NIT-01/history-analysis?range=2y")
    assert res_2y.status_code == 200
    assert res_2y.json()["selected_range"] == "2y"

    res_3y = client.get("/api/wells/WELL-NIT-01/history-analysis?range=3y")
    assert res_3y.status_code == 200
    assert res_3y.json()["selected_range"] == "3y"


def test_historical_readings_endpoint_backward_compatibility():
    """Verify GET /api/wells/{well_id}/readings works with and without range parameters."""
    res_legacy = client.get("/api/wells/WELL-NIT-01/readings?limit=10")
    assert res_legacy.status_code == 200
    assert isinstance(res_legacy.json(), list)
    assert len(res_legacy.json()) <= 10

    res_range = client.get("/api/wells/WELL-NIT-01/readings?range=recent")
    assert res_range.status_code == 200
    assert isinstance(res_range.json(), list)
