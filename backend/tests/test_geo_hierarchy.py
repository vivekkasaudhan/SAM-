import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Well, Sensor, Reading

client = TestClient(app)


def test_cascading_geo_countries():
    """Requirement 1, 4 & 6: Verify countries lookup contains India and global reference countries."""
    res = client.get("/api/geo/countries")
    assert res.status_code == 200
    countries = res.json()
    assert isinstance(countries, list)
    assert len(countries) >= 4
    assert "India" in countries
    assert "United States" in countries
    assert "United Kingdom" in countries


def test_cascading_geo_states():
    """Requirement 1, 3 & 4: Cascading states lookup for a country with case-insensitivity."""
    # Default India
    res = client.get("/api/geo/states?country=India")
    assert res.status_code == 200
    states = res.json()
    assert "Jharkhand" in states
    assert "West Bengal" in states
    assert "Maharashtra" in states

    # Case-insensitive query
    res_lower = client.get("/api/geo/states?country=india")
    assert res_lower.status_code == 200
    assert "Jharkhand" in res_lower.json()

    # Other country: United States
    res_us = client.get("/api/geo/states?country=United%20States")
    assert res_us.status_code == 200
    us_states = res_us.json()
    assert "California" in us_states
    assert "Texas" in us_states


def test_cascading_geo_districts():
    """Requirement 1, 3 & 4: Cascading districts lookup for a state with case-insensitivity."""
    res = client.get("/api/geo/districts?state=Jharkhand&country=India")
    assert res.status_code == 200
    districts = res.json()
    assert "East Singhbhum" in districts
    assert "West Singhbhum" in districts
    assert "Ranchi" in districts
    assert "Dhanbad" in districts

    # Case-insensitive state
    res_ci = client.get("/api/geo/districts?state=jharkhand")
    assert res_ci.status_code == 200
    assert "East Singhbhum" in res_ci.json()


def test_cascading_geo_cities():
    """Requirement 1, 3 & 4: Cascading cities lookup for a district."""
    res = client.get("/api/geo/cities?district=East%20Singhbhum&state=Jharkhand&country=India")
    assert res.status_code == 200
    cities = res.json()
    assert "Jamshedpur" in cities
    assert "Ghatshila" in cities
    assert "Musabani" in cities

    # Case-insensitive district
    res_ci = client.get("/api/geo/cities?district=east%20singhbhum")
    assert res_ci.status_code == 200
    assert "Jamshedpur" in res_ci.json()


def test_geo_coordinate_resolution():
    """Requirement 3 & 6: Offline-fast coordinate hierarchy resolution respecting Nominatim policy."""
    # Jamshedpur coordinates (NIT Jamshedpur)
    res = client.get("/api/geo/resolve?lat=22.7772&lon=86.1441")
    assert res.status_code == 200
    geo = res.json()
    assert geo["country"] == "India"
    assert geo["state"] == "Jharkhand"
    assert geo["district"] == "East Singhbhum"
    assert geo["city"] == "Jamshedpur"


def test_demo_wells_geographic_metadata():
    """Requirement 7: Verify demo wells have verified geographic metadata (India -> Jharkhand -> East Singhbhum -> Jamshedpur)."""
    res1 = client.get("/api/wells/WELL-NIT-01")
    assert res1.status_code == 200
    w1 = res1.json()
    assert w1["country"] == "India"
    assert w1["state"] == "Jharkhand"
    assert w1["district"] == "East Singhbhum"
    assert w1["city"] == "Jamshedpur"

    res2 = client.get("/api/wells/WELL-NIT-02")
    assert res2.status_code == 200
    w2 = res2.json()
    assert w2["country"] == "India"
    assert w2["state"] == "Jharkhand"
    assert w2["district"] == "East Singhbhum"
    assert w2["city"] == "Jamshedpur"


def test_backend_well_filtering_by_geographic_hierarchy():
    """Requirement 5: Test backend/database filtering of wells by country, state, district, and city."""
    # 1. Filter by country
    res_country = client.get("/api/wells?country=India")
    assert res_country.status_code == 200
    wells_india = res_country.json()
    assert len(wells_india) >= 2
    assert all(w["country"] == "India" for w in wells_india)

    # 2. Filter by state (case-insensitive)
    res_state = client.get("/api/wells?state=jharkhand")
    assert res_state.status_code == 200
    wells_jharkhand = res_state.json()
    assert len(wells_jharkhand) >= 2
    assert all(w["state"] == "Jharkhand" for w in wells_jharkhand)

    # 3. Filter by district (case-insensitive)
    res_dist = client.get("/api/wells?district=east%20singhbhum")
    assert res_dist.status_code == 200
    wells_dist = res_dist.json()
    assert len(wells_dist) >= 2
    assert all(w["district"] == "East Singhbhum" for w in wells_dist)

    # 4. Filter by city (case-insensitive)
    res_city = client.get("/api/wells?city=jamshedpur")
    assert res_city.status_code == 200
    wells_city = res_city.json()
    assert len(wells_city) >= 2
    assert all(w["city"] == "Jamshedpur" for w in wells_city)

    # 5. Combined filter: state + district + city
    res_combined = client.get("/api/wells?state=Jharkhand&district=East%20Singhbhum&city=Jamshedpur")
    assert res_combined.status_code == 200
    assert len(res_combined.json()) >= 2

    # 6. Non-existent filter should return empty list (filtered at database level)
    res_none = client.get("/api/wells?state=NonExistentState")
    assert res_none.status_code == 200
    assert res_none.json() == []

    res_none_city = client.get("/api/wells?city=NonExistentCity")
    assert res_none_city.status_code == 200
    assert res_none_city.json() == []


def test_well_creation_with_geographic_hierarchy():
    """Requirement 2, 3 & 5: Create a well with geographic metadata and verify database filtering."""
    # 1. Admin login
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "admin",
        "password": "AdminAquaSense@2026",
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create test well in a distinct location (e.g. West Bengal -> Kolkata -> Kolkata -> Kolkata)
    test_well_payload = {
        "name": "Kolkata Hooghly Test Well",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "country": "India",
        "state": "West Bengal",
        "district": "Kolkata",
        "city": "Kolkata",
        "location_description": "Hooghly Basin Test Observation Well",
        "warning_level_m": 6.0,
        "danger_level_m": 7.0,
    }
    create_res = client.post("/api/wells", json=test_well_payload, headers=headers)
    assert create_res.status_code == 201
    created = create_res.json()
    test_well_id = created["id"]
    assert created["state"] == "West Bengal"
    assert created["district"] == "Kolkata"
    assert created["city"] == "Kolkata"

    try:
        # 3. Query filtered by West Bengal
        res_wb = client.get("/api/wells?state=West%20Bengal")
        assert res_wb.status_code == 200
        wb_wells = res_wb.json()
        assert any(w["id"] == test_well_id for w in wb_wells)
        assert all(w["state"] == "West Bengal" for w in wb_wells)

        # 4. Verify Jharkhand filter does NOT contain the Kolkata test well
        res_jh = client.get("/api/wells?state=Jharkhand")
        assert res_jh.status_code == 200
        assert not any(w["id"] == test_well_id for w in res_jh.json())

        # 5. Update geographic metadata
        update_res = client.put(
            f"/api/wells/{test_well_id}",
            json={"city": "Alipore"},
            headers=headers,
        )
        assert update_res.status_code == 200
        assert update_res.json()["city"] == "Alipore"

        res_alipore = client.get("/api/wells?city=Alipore")
        assert res_alipore.status_code == 200
        assert any(w["id"] == test_well_id for w in res_alipore.json())
    finally:
        # Cleanup test well
        db = SessionLocal()
        try:
            db.query(Reading).filter(Reading.well_id == test_well_id).delete()
            db.query(Sensor).filter(Sensor.well_id == test_well_id).delete()
            db.query(Well).filter(Well.id == test_well_id).delete()
            db.commit()
        finally:
            db.close()


def test_uttar_pradesh_and_lucknow_hierarchical_filtering():
    """
    Verify complete hierarchical filtering for Uttar Pradesh and Lucknow:
    1. Select India -> Lucknow and Jharkhand wells appear.
    2. Select Uttar Pradesh without selecting district/city -> Lucknow well appears.
    3. Select state alias 'UP' -> same Lucknow well appears.
    4. Select district Lucknow -> Lucknow well appears.
    5. Select city Lucknow -> only Lucknow city wells appear.
    6. Select another district (e.g. Kanpur Nagar) -> Lucknow well excluded.
    7. Clear city filter -> Lucknow well reappears for state / district.
    """
    # 1. India scope
    res_in = client.get("/api/wells?country=India")
    assert res_in.status_code == 200
    wells_in = res_in.json()
    assert any("lucknow" in w["name"].lower() or w.get("city") == "Lucknow" for w in wells_in)
    assert any("jamshedpur" in w["name"].lower() or w.get("city") == "Jamshedpur" for w in wells_in)

    # 2. State Uttar Pradesh without district or city
    res_up = client.get("/api/wells?country=India&state=Uttar%20Pradesh")
    assert res_up.status_code == 200
    wells_up = res_up.json()
    assert len(wells_up) >= 1
    assert all(w.get("state") == "Uttar Pradesh" for w in wells_up)
    assert any(w.get("city") == "Lucknow" for w in wells_up)
    assert not any(w.get("state") == "Jharkhand" for w in wells_up)

    # 3. State alias 'UP' (case-insensitive)
    res_up_alias = client.get("/api/wells?country=India&state=UP")
    assert res_up_alias.status_code == 200
    wells_up_alias = res_up_alias.json()
    assert len(wells_up_alias) == len(wells_up)
    assert any(w.get("city") == "Lucknow" for w in wells_up_alias)

    # 4. District Lucknow
    res_dist = client.get("/api/wells?country=India&state=Uttar%20Pradesh&district=Lucknow")
    assert res_dist.status_code == 200
    wells_dist = res_dist.json()
    assert len(wells_dist) >= 1
    assert all(w.get("district") == "Lucknow" for w in wells_dist)

    # 5. City Lucknow
    res_city = client.get("/api/wells?country=India&state=Uttar%20Pradesh&district=Lucknow&city=Lucknow")
    assert res_city.status_code == 200
    wells_city = res_city.json()
    assert len(wells_city) >= 1
    assert all(w.get("city") == "Lucknow" for w in wells_city)

    # 6. Another district (e.g. Kanpur Nagar) excludes Lucknow well
    res_kanpur = client.get("/api/wells?country=India&state=Uttar%20Pradesh&district=Kanpur%20Nagar")
    assert res_kanpur.status_code == 200
    assert not any(w.get("city") == "Lucknow" for w in res_kanpur.json())

    # 7. Empty string or 'All' district/city parameters do NOT exclude wells
    res_empty_params = client.get("/api/wells?country=India&state=Uttar%20Pradesh&district=&city=")
    assert res_empty_params.status_code == 200
    assert len(res_empty_params.json()) == len(wells_up)


def test_cascading_cities_by_state_when_district_omitted():
    """Verify /api/geo/cities supports state-level querying when district is omitted."""
    res = client.get("/api/geo/cities?state=Uttar%20Pradesh")
    assert res.status_code == 200
    cities = res.json()
    assert "Lucknow" in cities
    assert "Kanpur" in cities
    assert "Varanasi" in cities

    # Alias UP
    res_alias = client.get("/api/geo/cities?state=UP")
    assert res_alias.status_code == 200
    assert "Lucknow" in res_alias.json()
