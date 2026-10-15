import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, User, Well, Sensor, Reading, init_db
from app.auth import hash_password, create_session_token

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_rbac_test_users_and_wells():
    """Seed test users: Main Admin, Subadmin 1, Subadmin 2."""
    init_db()
    session = SessionLocal()
    try:
        # 1. Main Admin
        admin = session.query(User).filter(User.username == "test_main_admin").first()
        if not admin:
            admin = User(
                username="test_main_admin",
                email="main_admin@aquasense.test",
                full_name="Test Main Administrator",
                hashed_password=hash_password("AdminPass@2026"),
                role="MAIN_ADMIN",
                is_active=True,
            )
            session.add(admin)
            session.commit()
            session.refresh(admin)

        # 2. Subadmin 1
        sub1 = session.query(User).filter(User.username == "test_subadmin_1").first()
        if not sub1:
            sub1 = User(
                username="test_subadmin_1",
                email="subadmin1@aquasense.test",
                full_name="Subadmin One",
                hashed_password=hash_password("Sub1Pass@2026"),
                role="SUBADMIN",
                is_active=True,
            )
            session.add(sub1)
            session.commit()
            session.refresh(sub1)

        # 3. Subadmin 2
        sub2 = session.query(User).filter(User.username == "test_subadmin_2").first()
        if not sub2:
            sub2 = User(
                username="test_subadmin_2",
                email="subadmin2@aquasense.test",
                full_name="Subadmin Two",
                hashed_password=hash_password("Sub2Pass@2026"),
                role="SUBADMIN",
                is_active=True,
            )
            session.add(sub2)
            session.commit()
            session.refresh(sub2)

    finally:
        session.close()


def get_auth_headers(username: str) -> dict:
    token = create_session_token(username)
    return {"Authorization": f"Bearer {token}"}


def test_1_and_4_subadmin_1_creates_well_and_subadmin_2_can_view():
    """
    Verify:
    - Subadmin 1 can create their own well.
    - Subadmin 2 can view Subadmin 1's well in the well list.
    """
    sub1_headers = get_auth_headers("test_subadmin_1")
    sub2_headers = get_auth_headers("test_subadmin_2")

    payload = {
        "name": "Subadmin 1 Test Well Alpha",
        "latitude": 23.3441,
        "longitude": 85.3096,
        "country": "India",
        "state": "Jharkhand",
        "district": "Ranchi",
        "city": "Ranchi",
        "warning_level_m": 7.0,
        "danger_level_m": 8.0,
        "water_level_m": 5.4,
    }

    # 1. Subadmin 1 creates a well
    res = client.post("/api/wells", json=payload, headers=sub1_headers)
    assert res.status_code == 201, res.text
    well_data = res.json()
    well_id = well_data["id"]
    assert well_data["name"] == "Subadmin 1 Test Well Alpha"
    assert well_data["creator"]["username"] == "test_subadmin_1"
    assert well_data["creator"]["email"] == "subadmin1@aquasense.test"

    # 2. Subadmin 2 can view Subadmin 1's well in the list
    list_res = client.get("/api/wells", headers=sub2_headers)
    assert list_res.status_code == 200
    all_wells = list_res.json()
    found = [w for w in all_wells if w["id"] == well_id]
    assert len(found) == 1
    assert found[0]["creator"]["name"] == "Subadmin One"
    assert found[0]["creator"]["email"] == "subadmin1@aquasense.test"


def test_2_subadmin_2_can_view_subadmin_1_well_details_and_history():
    """
    Verify:
    - Subadmin 2 can view Subadmin 1's well details and historical readings.
    """
    sub1_headers = get_auth_headers("test_subadmin_1")
    sub2_headers = get_auth_headers("test_subadmin_2")

    # Create well as subadmin 1
    res = client.post("/api/wells", json={
        "name": "Subadmin 1 Hydro Station",
        "latitude": 22.8046,
        "longitude": 86.2029,
        "country": "India",
        "state": "Jharkhand",
        "district": "East Singhbhum",
        "city": "Jamshedpur",
        "water_level_m": 6.1,
    }, headers=sub1_headers)
    assert res.status_code == 201
    well_id = res.json()["id"]

    # Subadmin 2 views details
    detail_res = client.get(f"/api/wells/{well_id}", headers=sub2_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == well_id
    assert detail["name"] == "Subadmin 1 Hydro Station"
    assert detail["creator"]["username"] == "test_subadmin_1"
    assert "parameter_sources" in detail

    # Subadmin 2 views readings/history
    readings_res = client.get(f"/api/wells/{well_id}/readings", headers=sub2_headers)
    assert readings_res.status_code == 200
    readings = readings_res.json()
    assert len(readings) > 0


def test_3_subadmin_2_cannot_edit_or_delete_subadmin_1_wells():
    """
    Verify:
    - Subadmin 2 CANNOT edit Subadmin 1's well (returns 403 Forbidden).
    - Subadmin 2 CANNOT delete Subadmin 1's well (returns 403 Forbidden).
    """
    sub1_headers = get_auth_headers("test_subadmin_1")
    sub2_headers = get_auth_headers("test_subadmin_2")

    # Create well as subadmin 1
    res = client.post("/api/wells", json={
        "name": "Protected Subadmin 1 Well",
        "latitude": 23.5000,
        "longitude": 85.5000,
        "country": "India",
        "state": "Jharkhand",
    }, headers=sub1_headers)
    assert res.status_code == 201
    well_id = res.json()["id"]

    # Subadmin 2 attempts PUT update -> 403 Forbidden
    put_res = client.put(
        f"/api/wells/{well_id}",
        json={"name": "Hacked by Subadmin 2"},
        headers=sub2_headers,
    )
    assert put_res.status_code == 403
    assert "Subadmins can only edit wells they created" in put_res.json()["detail"]

    # Subadmin 2 attempts PATCH update -> 403 Forbidden
    patch_res = client.patch(
        f"/api/wells/{well_id}",
        json={"name": "Hacked via patch"},
        headers=sub2_headers,
    )
    assert patch_res.status_code == 403

    # Subadmin 2 attempts DELETE -> 403 Forbidden
    del_res = client.delete(f"/api/wells/{well_id}", headers=sub2_headers)
    assert del_res.status_code == 403
    assert "Subadmins can only delete wells they created" in del_res.json()["detail"]

    # Subadmin 2 attempts sensor registration on Subadmin 1 well -> 403 Forbidden
    sensor_res = client.post("/api/sensors", json={
        "id": f"SENSOR-HACK-{well_id}",
        "well_id": well_id,
        "sensor_type": "Unauthorized Probe",
    }, headers=sub2_headers)
    assert sensor_res.status_code == 403


def test_4_and_5_subadmins_can_manage_their_own_wells():
    """
    Verify:
    - Subadmin 1 can edit and delete their own wells.
    - Subadmin 2 can create, edit, and delete their own wells.
    """
    sub1_headers = get_auth_headers("test_subadmin_1")
    sub2_headers = get_auth_headers("test_subadmin_2")

    # 1. Subadmin 1 creates a well
    res1 = client.post("/api/wells", json={
        "name": "Subadmin 1 Self Well",
        "latitude": 24.1000,
        "longitude": 86.1000,
    }, headers=sub1_headers)
    assert res1.status_code == 201
    w1_id = res1.json()["id"]

    # Subadmin 1 updates their own well
    up1 = client.put(f"/api/wells/{w1_id}", json={"name": "Subadmin 1 Self Well Updated"}, headers=sub1_headers)
    assert up1.status_code == 200
    assert up1.json()["name"] == "Subadmin 1 Self Well Updated"

    # Subadmin 1 deletes their own well
    del1 = client.delete(f"/api/wells/{w1_id}", headers=sub1_headers)
    assert del1.status_code == 200

    # 2. Subadmin 2 creates their own well
    res2 = client.post("/api/wells", json={
        "name": "Subadmin 2 Self Well",
        "latitude": 25.1000,
        "longitude": 87.1000,
    }, headers=sub2_headers)
    assert res2.status_code == 201
    w2_id = res2.json()["id"]

    # Subadmin 2 updates their own well
    up2 = client.put(f"/api/wells/{w2_id}", json={"name": "Subadmin 2 Self Well Updated"}, headers=sub2_headers)
    assert up2.status_code == 200
    assert up2.json()["name"] == "Subadmin 2 Self Well Updated"

    # Subadmin 2 deletes their own well
    del2 = client.delete(f"/api/wells/{w2_id}", headers=sub2_headers)
    assert del2.status_code == 200


def test_6_main_admin_can_view_edit_and_delete_every_well():
    """
    Verify:
    - Main Admin can view wells created by any Subadmin.
    - Main Admin can edit any Subadmin's well.
    - Main Admin can delete any Subadmin's well.
    """
    sub1_headers = get_auth_headers("test_subadmin_1")
    admin_headers = get_auth_headers("test_main_admin")

    # Subadmin 1 creates a well
    create_res = client.post("/api/wells", json={
        "name": "Subadmin 1 Well for Admin Test",
        "latitude": 26.1000,
        "longitude": 88.1000,
        "state": "Bihar",
    }, headers=sub1_headers)
    assert create_res.status_code == 201
    well_id = create_res.json()["id"]

    # Main Admin views well
    admin_get = client.get(f"/api/wells/{well_id}", headers=admin_headers)
    assert admin_get.status_code == 200
    assert admin_get.json()["creator"]["name"] == "Subadmin One"
    assert admin_get.json()["creator"]["email"] == "subadmin1@aquasense.test"

    # Main Admin edits Subadmin 1's well
    admin_edit = client.put(
        f"/api/wells/{well_id}",
        json={"name": "Subadmin 1 Well - Admin Override"},
        headers=admin_headers,
    )
    assert admin_edit.status_code == 200
    assert admin_edit.json()["name"] == "Subadmin 1 Well - Admin Override"

    # Main Admin deletes Subadmin 1's well
    admin_del = client.delete(f"/api/wells/{well_id}", headers=admin_headers)
    assert admin_del.status_code == 200


def test_7_unauthenticated_users_cannot_access_protected_well_endpoints():
    """
    Verify:
    - POST /api/wells returns 401 Unauthorized without auth headers.
    - PUT /api/wells/{id} returns 401 Unauthorized without auth headers.
    - DELETE /api/wells/{id} returns 401 Unauthorized without auth headers.
    - POST /api/sensors returns 401 Unauthorized without auth headers.
    """
    # 1. POST /api/wells
    res_post = client.post("/api/wells", json={"name": "Unauth Well", "latitude": 20.0, "longitude": 80.0})
    assert res_post.status_code == 401

    # 2. PUT /api/wells/{id}
    res_put = client.put("/api/wells/WELL-ANY", json={"name": "Unauth Edit"})
    assert res_put.status_code == 401

    # 3. DELETE /api/wells/{id}
    res_del = client.delete("/api/wells/WELL-ANY")
    assert res_del.status_code == 401

    # 4. POST /api/sensors
    res_sensor = client.post("/api/sensors", json={"id": "SENSOR-ANY", "well_id": "WELL-ANY", "sensor_type": "Probe"})
    assert res_sensor.status_code == 401


def test_main_admin_subadmin_management_and_filter():
    """
    Verify:
    - Main Admin can filter wells by Subadmin.
    - Main Admin can create a Subadmin account.
    - Subadmin CANNOT create a Subadmin account (returns 403).
    - Main Admin can delete a Subadmin account.
    - Subadmin CANNOT delete a Subadmin account (returns 403).
    """
    admin_headers = get_auth_headers("test_main_admin")
    sub1_headers = get_auth_headers("test_subadmin_1")

    # 1. Main Admin creates a new Subadmin account
    create_sub_res = client.post("/api/auth/subadmins", json={
        "username": "managed_subadmin",
        "email": "managed@aquasense.test",
        "password": "ManagedPass@2026",
        "full_name": "Managed Subadmin User",
    }, headers=admin_headers)
    assert create_sub_res.status_code == 201
    created_sub = create_sub_res.json()
    managed_sub_id = created_sub["id"]
    assert created_sub["username"] == "managed_subadmin"
    assert created_sub["role"] == "SUBADMIN"

    # 2. Subadmin 1 attempts to create a Subadmin -> 403 Forbidden
    sub_forbidden_res = client.post("/api/auth/subadmins", json={
        "username": "illegal_subadmin",
        "email": "illegal@aquasense.test",
        "password": "IllegalPass@2026",
    }, headers=sub1_headers)
    assert sub_forbidden_res.status_code == 403

    # 3. Subadmin 1 attempts public signup while logged in -> 403 Forbidden
    sub_signup_res = client.post("/api/auth/signup", json={
        "username": "illegal_signup",
        "email": "illegalsignup@aquasense.test",
        "password": "IllegalPass@2026",
    }, headers=sub1_headers)
    assert sub_signup_res.status_code == 403

    # 4. Filter wells by subadmin_id
    # Create well under managed_subadmin
    managed_headers = get_auth_headers("managed_subadmin")
    client.post("/api/wells", json={
        "name": "Managed Well 1",
        "latitude": 27.0,
        "longitude": 82.0,
    }, headers=managed_headers)

    filter_res = client.get(f"/api/wells?subadmin_id={managed_sub_id}", headers=admin_headers)
    assert filter_res.status_code == 200
    filtered_wells = filter_res.json()
    assert len(filtered_wells) >= 1
    assert all(w["created_by"] == managed_sub_id for w in filtered_wells)
    assert all(w["creator"]["username"] == "managed_subadmin" for w in filtered_wells)

    # 5. Subadmin 1 attempts to delete a Subadmin -> 403 Forbidden
    sub_del_res = client.delete(f"/api/auth/subadmins/{managed_sub_id}", headers=sub1_headers)
    assert sub_del_res.status_code == 403

    # 6. Main Admin deletes the Subadmin account
    admin_del_res = client.delete(f"/api/auth/subadmins/{managed_sub_id}", headers=admin_headers)
    assert admin_del_res.status_code == 200
