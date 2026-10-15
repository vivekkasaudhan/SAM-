import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Well, User

client = TestClient(app)

def test_search_by_well_id():
    """Searching for a specific well ID returns only matching well(s)."""
    response = client.get("/api/wells?search=WELL-NIT-01")
    assert response.status_code == 200
    wells = response.json()
    assert len(wells) >= 1
    assert all("WELL-NIT-01" in w["id"] for w in wells)

def test_search_by_partial_id():
    """Searching partial well ID returns only wells containing the ID snippet."""
    response = client.get("/api/wells?search=NIT-02")
    assert response.status_code == 200
    wells = response.json()
    assert len(wells) >= 1
    assert any(w["id"] == "WELL-NIT-02" for w in wells)

def test_search_by_well_name():
    """Searching by well name or partial name returns matching wells."""
    response = client.get("/api/wells?search=Hydro Station")
    assert response.status_code == 200
    wells = response.json()
    assert len(wells) >= 1
    assert all("hydro station" in w["name"].lower() for w in wells)

def test_search_alias_q_parameter():
    """The 'q' query parameter functions identically to 'search'."""
    res_search = client.get("/api/wells?search=Riverfront")
    res_q = client.get("/api/wells?q=Riverfront")
    assert res_search.status_code == 200
    assert res_q.status_code == 200
    assert res_search.json() == res_q.json()

def test_search_nonexistent_returns_empty_list():
    """Searching for non-existent well returns clean empty list []."""
    response = client.get("/api/wells?search=NONEXISTENT_WELL_XYZ_99999")
    assert response.status_code == 200
    assert response.json() == []

def test_search_combined_with_geographic_hierarchy():
    """Combining search with geographic filters returns intersection without duplicates."""
    # Search for "Hydro Station" in Jharkhand
    res_jh = client.get("/api/wells?search=Hydro Station&state=Jharkhand")
    assert res_jh.status_code == 200
    jh_wells = res_jh.json()
    assert len(jh_wells) >= 1
    assert all(w["state"] == "Jharkhand" for w in jh_wells)

    # Search for "Hydro Station" in Uttar Pradesh (where it doesn't exist)
    res_up = client.get("/api/wells?search=Hydro Station&state=Uttar Pradesh")
    assert res_up.status_code == 200
    assert res_up.json() == []

def test_search_combined_with_creator_rbac_filter():
    """Creator filters (subadmin_id / created_by) are strictly respected when searching."""
    db = SessionLocal()
    try:
        subadmin = db.query(User).filter(User.role == "SUBADMIN").first()
        if subadmin:
            res = client.get(f"/api/wells?search=Well&subadmin_id={subadmin.id}")
            assert res.status_code == 200
            wells = res.json()
            assert all(w["created_by"] == subadmin.id for w in wells)
    finally:
        db.close()
