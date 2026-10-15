"""
Script to curate the AquaSense database to exactly 30 wells:
- 15 from Jharkhand (JH)
- 15 from Uttar Pradesh (UP)
- 20 added by Main Admin (created_by = 1)
- 10 added by Subadmin Vivek Kasaudhan (created_by = 7)
- 5 wells at Danger level (latest water_level_m >= danger_level_m)
- 4 wells at Warning level (warning_level_m <= latest water_level_m < danger_level_m)
- 21 wells at Normal level (latest water_level_m < warning_level_m)
- Multi-year 3-year telemetry preserved for all 30 wells.
"""
import os
import sqlite3
from datetime import datetime, timezone, timedelta
from app.models.database import SessionLocal, Well, Reading, User, LithologyLayer, Sensor, Alert, WaterLevelForecast
from app.services.historical_simulation_service import HistoricalSimulationService
from app.services.early_warning_service import EarlyWarningService

def configure_30_wells():
    print("=" * 80)
    print("CONFIGURING EXACTLY 30 WELLS IN AQUASENSE DATABASE")
    print("=" * 80)

    db = SessionLocal()
    now = datetime.now(timezone.utc)

    # 1. Verify Users
    main_admin = db.query(User).filter(User.id == 1).first()
    assert main_admin is not None, "Main Admin (ID 1) not found!"
    
    vivek_user = db.query(User).filter(User.id == 7).first()
    if not vivek_user:
        vivek_user = db.query(User).filter(User.full_name.ilike("%Vivek Kasaudhan%")).first()
    assert vivek_user is not None, "Vivek Kasaudhan user not found!"
    vivek_id = vivek_user.id
    print(f"Main Admin User: ID {main_admin.id} ({main_admin.full_name})")
    print(f"Subadmin User: ID {vivek_id} ({vivek_user.full_name})")

    # 2. Define the exact 30 wells specification
    # (id, name, state, district, city, lat, lon, total_depth, warn_m, danger_m, creator_id, target_risk_status, target_wl)
    # 15 Jharkhand wells
    jh_wells_spec = [
        # 1. WELL-NIT-01 (Normal, Main Admin)
        ("WELL-NIT-01", "NIT Jamshedpur Campus Deep Borewell", "Jharkhand", "East Singhbhum", "Jamshedpur", 22.772, 86.144, 60.0, 7.0, 8.5, 1, "NORMAL", 4.25),
        # 2. WELL-NIT-02 (Normal, Main Admin)
        ("WELL-NIT-02", "Adityapur Industrial Monitoring Station", "Jharkhand", "East Singhbhum", "Jamshedpur", 22.788, 86.167, 55.0, 7.0, 8.5, 1, "NORMAL", 4.80),
        # 3. WELL-LITHO-02 (Normal, Main Admin)
        ("WELL-LITHO-02", "Dhanbad Geological Research Station", "Jharkhand", "Dhanbad", "Dhanbad", 23.814, 86.441, 75.0, 7.0, 8.5, 1, "NORMAL", 3.90),
        # 4. WELL-8D2930 (Normal, Vivek Kasaudhan)
        ("WELL-8D2930", "Jamshedpur Central Hydro Station", "Jharkhand", "East Singhbhum", "Jamshedpur", 22.805, 86.202, 50.0, 7.0, 8.5, vivek_id, "NORMAL", 4.40),
        # 5. WELL-JH-01 (Danger 1, Vivek Kasaudhan)
        ("WELL-JH-01", "Ranchi Morabadi Aquifer Station", "Jharkhand", "Ranchi", "Ranchi", 23.395, 85.325, 65.0, 7.0, 8.5, vivek_id, "DANGER", 8.92),
        # 6. WELL-JH-02 (Normal, Vivek Kasaudhan)
        ("WELL-JH-02", "Ranchi Hatia Dam Monitoring Well", "Jharkhand", "Ranchi", "Ranchi", 23.310, 85.305, 52.0, 7.0, 8.5, vivek_id, "NORMAL", 4.15),
        # 7. WELL-JH-03 (Warning 1, Vivek Kasaudhan)
        ("WELL-JH-03", "Bokaro Steel City Hydro Station", "Jharkhand", "Bokaro", "Bokaro", 23.669, 86.151, 58.0, 7.0, 8.5, vivek_id, "WARNING", 7.65),
        # 8. WELL-JH-04 (Normal, Vivek Kasaudhan)
        ("WELL-JH-04", "Dhanbad Coalfields Deep Aquifer", "Jharkhand", "Dhanbad", "Dhanbad", 23.795, 86.430, 70.0, 7.0, 8.5, vivek_id, "NORMAL", 4.50),
        # 9. WELL-JH-05 (Normal, Main Admin)
        ("WELL-JH-05", "Hazaribagh Plateau Monitoring Well", "Jharkhand", "Hazaribagh", "Hazaribagh", 23.996, 85.364, 48.0, 7.0, 8.5, 1, "NORMAL", 3.85),
        # 10. WELL-JH-06 (Danger 2, Main Admin)
        ("WELL-JH-06", "Deoghar Temple Complex Aquifer", "Jharkhand", "Deoghar", "Deoghar", 24.485, 86.700, 50.0, 6.5, 8.0, 1, "DANGER", 8.45),
        # 11. WELL-JH-07 (Normal, Main Admin)
        ("WELL-JH-07", "Giridih Parasnath Hydro Station", "Jharkhand", "Giridih", "Giridih", 24.186, 86.307, 62.0, 7.0, 8.5, 1, "NORMAL", 4.60),
        # 12. WELL-JH-08 (Warning 2, Main Admin)
        ("WELL-JH-08", "Chaibasa Iron Ore Belt Well", "Jharkhand", "West Singhbhum", "Chaibasa", 22.552, 85.808, 54.0, 6.8, 8.5, 1, "WARNING", 7.42),
        # 13. WELL-JH-09 (Normal, Main Admin)
        ("WELL-JH-09", "Ramgarh Damodar Basin Well", "Jharkhand", "Ramgarh", "Ramgarh", 23.628, 85.518, 45.0, 7.0, 8.5, 1, "NORMAL", 4.10),
        # 14. WELL-JH-10 (Normal, Main Admin)
        ("WELL-JH-10", "Dumka Santhal Pargana Well", "Jharkhand", "Dumka", "Dumka", 24.268, 87.248, 52.0, 7.0, 8.5, 1, "NORMAL", 3.75),
        # 15. WELL-JH-11 (Danger 3, Main Admin)
        ("WELL-JH-11", "Medininagar Palamu Drought Node", "Jharkhand", "Palamu", "Medininagar", 24.041, 84.072, 65.0, 7.0, 8.5, 1, "DANGER", 9.10),
    ]

    # 15 Uttar Pradesh wells
    up_wells_spec = [
        # 16. WELL-LITHO-01 (Normal, Main Admin)
        ("WELL-LITHO-01", "North Alluvial Research Borehole", "Uttar Pradesh", "Lucknow", "Lucknow", 26.847, 80.946, 60.0, 7.5, 8.5, 1, "NORMAL", 4.30),
        # 17. WELL-63C20C (Normal, Main Admin)
        ("WELL-63C20C", "Lucknow Hazratganj Telemetry Well", "Uttar Pradesh", "Lucknow", "Lucknow", 26.852, 80.941, 55.0, 7.5, 8.5, 1, "NORMAL", 4.70),
        # 18. WELL-UP-01 (Danger 4, Vivek Kasaudhan)
        ("WELL-UP-01", "Kanpur Ganga Basin Monitoring Well", "Uttar Pradesh", "Kanpur Nagar", "Kanpur", 26.449, 80.331, 70.0, 7.0, 8.5, vivek_id, "DANGER", 8.85),
        # 19. WELL-UP-02 (Normal, Vivek Kasaudhan)
        ("WELL-UP-02", "Varanasi Assi Ghat Aquifer Station", "Uttar Pradesh", "Varanasi", "Varanasi", 25.317, 82.973, 62.0, 7.0, 8.5, vivek_id, "NORMAL", 4.90),
        # 20. WELL-UP-03 (Normal, Vivek Kasaudhan)
        ("WELL-UP-03", "Prayagraj Sangam Alluvial Well", "Uttar Pradesh", "Prayagraj", "Prayagraj", 25.435, 81.846, 68.0, 7.0, 8.5, vivek_id, "NORMAL", 4.10),
        # 21. WELL-UP-04 (Warning 3, Vivek Kasaudhan)
        ("WELL-UP-04", "Agra Yamuna Floodplain Well", "Uttar Pradesh", "Agra", "Agra", 27.176, 78.008, 58.0, 7.0, 8.5, vivek_id, "WARNING", 7.82),
        # 22. WELL-UP-05 (Normal, Vivek Kasaudhan)
        ("WELL-UP-05", "Meerut Upper Doab Hydro Well", "Uttar Pradesh", "Meerut", "Meerut", 28.984, 77.706, 52.0, 7.0, 8.5, vivek_id, "NORMAL", 4.45),
        # 23. WELL-UP-06 (Normal, Main Admin)
        ("WELL-UP-06", "Noida Sector 62 Aquifer Node", "Uttar Pradesh", "Gautam Buddha Nagar", "Noida", 28.628, 77.365, 50.0, 7.0, 8.5, 1, "NORMAL", 4.60),
        # 24. WELL-UP-07 (Normal, Main Admin)
        ("WELL-UP-07", "Ghaziabad Hindon River Station", "Uttar Pradesh", "Ghaziabad", "Ghaziabad", 28.669, 77.453, 56.0, 7.0, 8.5, 1, "NORMAL", 4.35),
        # 25. WELL-UP-08 (Warning 4, Main Admin)
        ("WELL-UP-08", "Ayodhya Saryu Basin Well", "Uttar Pradesh", "Ayodhya", "Ayodhya", 26.792, 82.199, 54.0, 7.0, 8.5, 1, "WARNING", 7.55),
        # 26. WELL-UP-09 (Normal, Main Admin)
        ("WELL-UP-09", "Gorakhpur Rapti Basin Station", "Uttar Pradesh", "Gorakhpur", "Gorakhpur", 26.760, 83.373, 48.0, 7.0, 8.5, 1, "NORMAL", 4.20),
        # 27. WELL-UP-10 (Danger 5, Main Admin)
        ("WELL-UP-10", "Jhansi Bundelkhand Hardrock Station", "Uttar Pradesh", "Jhansi", "Jhansi", 25.448, 78.568, 65.0, 7.5, 8.5, 1, "DANGER", 8.78),
        # 28. WELL-UP-11 (Normal, Main Admin)
        ("WELL-UP-11", "Bareilly Rohilkhand Deep Well", "Uttar Pradesh", "Bareilly", "Bareilly", 28.367, 79.430, 55.0, 7.0, 8.5, 1, "NORMAL", 3.95),
        # 29. WELL-UP-12 (Normal, Main Admin)
        ("WELL-UP-12", "Aligarh Central Doab Monitoring Well", "Uttar Pradesh", "Aligarh", "Aligarh", 27.897, 78.088, 50.0, 7.0, 8.5, 1, "NORMAL", 4.15),
        # 30. WELL-UP-13 (Normal, Main Admin)
        ("WELL-UP-13", "Mathura Krishna Basin Station", "Uttar Pradesh", "Mathura", "Mathura", 27.492, 77.673, 52.0, 7.0, 8.5, 1, "NORMAL", 4.50),
    ]

    all_specs = jh_wells_spec + up_wells_spec
    target_well_ids = [s[0] for s in all_specs]
    assert len(all_specs) == 30, f"Expected 30 wells, got {len(all_specs)}"
    assert len(target_well_ids) == len(set(target_well_ids)), "Duplicate well IDs in spec!"

    # Count verifications
    jh_count = sum(1 for s in all_specs if s[2] == "Jharkhand")
    up_count = sum(1 for s in all_specs if s[2] == "Uttar Pradesh")
    admin_count = sum(1 for s in all_specs if s[10] == 1)
    vivek_count = sum(1 for s in all_specs if s[10] == vivek_id)
    danger_count = sum(1 for s in all_specs if s[11] == "DANGER")
    warning_count = sum(1 for s in all_specs if s[11] == "WARNING")
    normal_count = sum(1 for s in all_specs if s[11] == "NORMAL")

    print(f"\n--- Verification of 30-Well Distribution ---")
    print(f"Jharkhand Wells: {jh_count} (Target: 15)")
    print(f"Uttar Pradesh Wells: {up_count} (Target: 15)")
    print(f"Main Admin Added: {admin_count} (Target: 20)")
    print(f"Vivek Kasaudhan Added: {vivek_count} (Target: 10)")
    print(f"Danger Level Wells: {danger_count} (Target: 5)")
    print(f"Warning Level Wells: {warning_count} (Target: 4)")
    print(f"Normal Level Wells: {normal_count} (Target: 21)")
    assert jh_count == 15 and up_count == 15
    assert admin_count == 20 and vivek_count == 10
    assert danger_count == 5 and warning_count == 4 and normal_count == 21

    # 3. Create or Update the 30 Target Wells in the database
    for spec in all_specs:
        wid, name, state, district, city, lat, lon, depth, warn_m, danger_m, creator, status_tag, target_wl = spec
        w = db.query(Well).filter(Well.id == wid).first()
        if not w:
            w = Well(
                id=wid,
                name=name,
                latitude=lat,
                longitude=lon,
                location_description=f"{city}, {state}",
                country="India",
                state=state,
                district=district,
                city=city,
                warning_level_m=warn_m,
                danger_level_m=danger_m,
                total_depth_m=depth,
                monitoring_type="SIMULATED",
                is_active=True,
                created_by=creator,
                created_at=now - timedelta(days=1095),
            )
            db.add(w)
        else:
            w.name = name
            w.latitude = lat
            w.longitude = lon
            w.location_description = f"{city}, {state}"
            w.country = "India"
            w.state = state
            w.district = district
            w.city = city
            w.warning_level_m = warn_m
            w.danger_level_m = danger_m
            w.total_depth_m = depth
            w.is_active = True
            w.created_by = creator
            w.monitoring_type = "SIMULATED"
    db.commit()

    # 4. Remove unwanted wells (not in target_well_ids)
    all_current_wells = db.query(Well).all()
    wells_to_delete = [w for w in all_current_wells if w.id not in target_well_ids]
    print(f"\nPruning {len(wells_to_delete)} surplus wells to keep exactly 30...")
    for w in wells_to_delete:
        db.query(Reading).filter(Reading.well_id == w.id).delete()
        db.query(Alert).filter(Alert.well_id == w.id).delete()
        db.query(WaterLevelForecast).filter(WaterLevelForecast.well_id == w.id).delete()
        db.query(Sensor).filter(Sensor.well_id == w.id).delete()
        db.query(LithologyLayer).filter(LithologyLayer.well_id == w.id).delete()
        db.delete(w)
    db.commit()

    # 5. Ensure all 30 wells have 3-year historical readings and accurate latest reading
    print("\nEnsuring 3-year historical readings and setting target water levels...")
    for spec in all_specs:
        wid, name, state, district, city, lat, lon, depth, warn_m, danger_m, creator, status_tag, target_wl = spec
        w = db.query(Well).filter(Well.id == wid).first()
        
        # Check if historical backfill is needed
        existing_count = db.query(Reading).filter(Reading.well_id == wid).count()
        if existing_count < 1000:
            print(f"  Backfilling 3-year history for {wid} ({name})...")
            HistoricalSimulationService.backfill_well_history(wid, span_days=1095, db=db)

        # Ensure latest reading matches target water level
        latest_reading = (
            db.query(Reading)
            .filter(Reading.well_id == wid)
            .order_by(Reading.timestamp.desc())
            .first()
        )
        if latest_reading:
            latest_reading.water_level_m = target_wl
            latest_reading.timestamp = now
        else:
            db.add(Reading(
                well_id=wid,
                water_level_m=target_wl,
                ph=7.2,
                tds_ppm=260.0,
                turbidity_ntu=2.5,
                dissolved_oxygen_mg_l=6.8,
                temperature_c=24.5,
                status="SIMULATED",
                source="SYNTHETIC",
                timestamp=now,
            ))
    db.commit()

    # 6. Re-evaluate early warning alerts
    print("\nRefreshing Early Warning System alerts for all 30 wells...")
    EarlyWarningService.evaluate_all_wells(db=db)

    # 7. Final Verification
    final_wells = db.query(Well).all()
    print(f"\nFinal Wells Count: {len(final_wells)}")
    assert len(final_wells) == 30, f"Expected 30 wells, found {len(final_wells)}"

    # Check state breakdown
    jh_final = [w for w in final_wells if w.state and "jharkhand" in w.state.lower()]
    up_final = [w for w in final_wells if w.state and "uttar pradesh" in w.state.lower()]
    print(f"Final Jharkhand Wells: {len(jh_final)}")
    print(f"Final Uttar Pradesh Wells: {len(up_final)}")
    assert len(jh_final) == 15
    assert len(up_final) == 15

    # Check creator breakdown
    admin_final = [w for w in final_wells if w.created_by == 1]
    vivek_final = [w for w in final_wells if w.created_by == vivek_id]
    print(f"Final Main Admin Wells: {len(admin_final)}")
    print(f"Final Vivek Kasaudhan Wells: {len(vivek_final)}")
    assert len(admin_final) == 20
    assert len(vivek_final) == 10

    # Check risk levels
    danger_wells = []
    warning_wells = []
    normal_wells = []
    for w in final_wells:
        latest_r = db.query(Reading).filter(Reading.well_id == w.id).order_by(Reading.timestamp.desc()).first()
        wl = latest_r.water_level_m if latest_r else 0.0
        if wl >= w.danger_level_m:
            danger_wells.append((w.id, w.name, wl, w.danger_level_m))
        elif wl >= w.warning_level_m:
            warning_wells.append((w.id, w.name, wl, w.warning_level_m, w.danger_level_m))
        else:
            normal_wells.append((w.id, w.name, wl))

    print(f"Final Danger Wells (target 5): {len(danger_wells)}")
    for d in danger_wells:
        print(f"  [DANGER] {d[0]}: {d[1]} (Level: {d[2]}m >= Danger: {d[3]}m)")
    assert len(danger_wells) == 5

    print(f"Final Warning Wells (target 4): {len(warning_wells)}")
    for wn in warning_wells:
        print(f"  [WARNING] {wn[0]}: {wn[1]} (Level: {wn[2]}m >= Warn: {wn[3]}m, < Danger: {wn[4]}m)")
    assert len(warning_wells) == 4

    print(f"Final Normal Wells (target 21): {len(normal_wells)}")
    assert len(normal_wells) == 21

    db.close()
    print("\n" + "=" * 80)
    print("ALL 30 WELLS CONFIGURED AND VERIFIED WITH 100% SUCCESS!")
    print("=" * 80)

if __name__ == "__main__":
    configure_30_wells()
