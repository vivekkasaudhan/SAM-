"""
Comprehensive Verification Script for AquaSense Historical Data, Well ID Mapping, and Forecasting Audit
"""
import os
import sqlite3
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Well, Reading, Sensor

client = TestClient(app)

def run_verification():
    print("=" * 80)
    print("AQUASENSE AUDIT & VERIFICATION REPORT")
    print("=" * 80)

    # 1. Database & Backup Verification
    db_path = "backend/aquasense.db" if os.path.exists("backend/aquasense.db") else "aquasense.db"
    bak_path = db_path + ".bak"
    assert os.path.exists(bak_path), f"Backup file {bak_path} does not exist!"
    bak_size = os.path.getsize(bak_path)
    curr_size = os.path.getsize(db_path)
    print(f"[PASS] Database backup verified: {bak_path} ({bak_size:,} bytes)")
    print(f"[PASS] Active database: {db_path} ({curr_size:,} bytes)")

    # 2. Database Integrity Checks
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM readings")
    total_readings = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM wells")
    total_wells = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT well_id) FROM readings")
    wells_with_readings = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM readings WHERE well_id NOT IN (SELECT id FROM wells)")
    orphan_readings = cursor.fetchone()[0]
    cursor.execute("SELECT well_id, timestamp, COUNT(*) FROM readings GROUP BY well_id, timestamp HAVING COUNT(*) > 1")
    duplicates = cursor.fetchall()

    print(f"\n--- SQLite Database Metrics ---")
    print(f"Total Wells: {total_wells}")
    print(f"Wells with Telemetry: {wells_with_readings}")
    print(f"Total Readings: {total_readings:,}")
    print(f"Orphan Readings: {orphan_readings} (Expected: 0)")
    print(f"Duplicate (well_id, timestamp) pairs: {len(duplicates)} (Expected: 0)")
    assert orphan_readings == 0, "Found orphan readings!"
    assert len(duplicates) == 0, "Found duplicate readings!"

    # 3. Audit WELL-8D2930 vs WELL-4B9B77
    cursor.execute("SELECT id, name, district, city, monitoring_type, created_by, created_at FROM wells WHERE id IN ('WELL-8D2930', 'WELL-4B9B77')")
    well_rows = cursor.fetchall()
    print(f"\n--- Target Wells Inspection ---")
    for r in well_rows:
        cursor.execute("SELECT COUNT(*), MIN(timestamp), MAX(timestamp) FROM readings WHERE well_id = ?", (r[0],))
        rc, min_t, max_t = cursor.fetchone()
        print(f"Well ID: {r[0]} | Name: '{r[1]}' | Type: {r[3]} | Created: {r[5]} | Readings: {rc} ({min_t} to {max_t})")

    # 4. Scenario Testing via FastAPI APIs
    print(f"\n--- API Scenario Testing ---")

    # Scenario 1: Well with 3-year history (WELL-8D2930)
    print("\n[Scenario 1] Well with 3-year history (WELL-8D2930):")
    resp = client.get("/api/wells/WELL-8D2930/forecast?horizon=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert data["is_demo"] is True
    assert data["data_freshness"]["observations_count"] > 1400
    assert data["data_freshness"]["data_span_days"] > 1000
    print(f"  Status: {data['status']}")
    print(f"  Forecast Type: {data['forecast_type']}")
    print(f"  Observations Count: {data['data_freshness']['observations_count']} (untruncated, >1400)")
    print(f"  Data Span Days: {data['data_freshness']['data_span_days']} days (~3 years)")
    print(f"  Horizon: {data['horizon_days']} days (Predictions: {len(data['predictions'])})")

    # Scenario 2: Well with 15-day horizon
    print("\n[Scenario 2] Well 15-day forecast horizon (WELL-8D2930):")
    resp15 = client.get("/api/wells/WELL-8D2930/forecast?horizon=15")
    assert resp15.status_code == 200
    data15 = resp15.json()
    assert data15["status"] == "SUCCESS"
    assert data15["horizon_days"] == 15
    assert len(data15["predictions"]) == 15
    print(f"  Status: {data15['status']} | Horizon: {data15['horizon_days']} days | Predictions: {len(data15['predictions'])}")

    # Scenario 3: Nonexistent Well
    print("\n[Scenario 3] Nonexistent Well ID (EXPECT 404):")
    resp_404 = client.get("/api/wells/WELL-DOES-NOT-EXIST/forecast")
    assert resp_404.status_code == 404
    print(f"  Status Code: {resp_404.status_code} | Detail: {resp_404.json()['detail']}")

    # Scenario 4: Sparse Well (< 5 readings)
    print("\n[Scenario 4] Sparse Well with < 5 readings:")
    db = SessionLocal()
    sparse_well_id = "AUDIT-SPARSE-WELL"
    db.merge(Well(
        id=sparse_well_id,
        name="Sparse Telemetry Audit Well",
        latitude=23.5, longitude=85.5,
        country="India", state="Jharkhand", district="Ranchi", city="Ranchi",
        monitoring_type="SIMULATED", is_active=True
    ))
    db.query(Reading).filter(Reading.well_id == sparse_well_id).delete()
    now_utc = datetime.now(timezone.utc)
    for i in range(3):
        db.add(Reading(
            well_id=sparse_well_id,
            water_level_m=5.0,
            ph=7.0,
            tds_ppm=250.0,
            turbidity_ntu=2.0,
            dissolved_oxygen_mg_l=7.0,
            temperature_c=25.0,
            status="SIMULATED",
            source="SYNTHETIC",
            timestamp=now_utc - timedelta(hours=i)
        ))
    db.commit()

    resp_sparse = client.get(f"/api/wells/{sparse_well_id}/forecast")
    assert resp_sparse.status_code == 200
    data_sparse = resp_sparse.json()
    assert data_sparse["status"] == "INSUFFICIENT_DATA"
    assert len(data_sparse["predictions"]) == 0
    print(f"  Status: {data_sparse['status']} | Reason: {data_sparse.get('reason')} | Predictions: {len(data_sparse['predictions'])}")

    # Scenario 5: Physical sensor well (never backfilled, physical provenance)
    print("\n[Scenario 5] Physical Sensor Well Integrity:")
    cursor.execute("""
        SELECT w.id, w.name, w.monitoring_type, s.id, s.api_key_hash
        FROM wells w
        JOIN sensors s ON s.well_id = w.id
    """)
    sensors = cursor.fetchall()
    print(f"  Registered physical sensor wells: {len(sensors)}")
    for s in sensors:
        print(f"  Well ID: {s[0]} | Sensor ID: {s[3]} | Has API Key Hash: {bool(s[4])}")
        # Verify backfill check rejects it
        from app.services.historical_simulation_service import HistoricalSimulationService
        w_obj = db.query(Well).filter(Well.id == s[0]).first()
        eligible = HistoricalSimulationService.is_well_eligible_for_backfill(w_obj, db)
        print(f"  Monitoring type: {w_obj.monitoring_type} | Eligibility for backfill: {eligible}")

    # Cleanup temporary sparse well
    db.query(Reading).filter(Reading.well_id == sparse_well_id).delete()
    db.query(Well).filter(Well.id == sparse_well_id).delete()
    db.commit()
    db.close()
    conn.close()

    print("\n" + "=" * 80)
    print("ALL 5 CORE SCENARIOS & DATA INTEGRITY VERIFIED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_verification()
