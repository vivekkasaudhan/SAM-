import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, User, Well, LithologyLayer, init_db
from app.auth import hash_password, create_session_token

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_lithology_test_context():
    """Ensure DB migration is run and test users and stations are seeded."""
    init_db()
    session = SessionLocal()
    try:
        # 1. Main Admin
        main_admin = session.query(User).filter(User.username == "litho_main_admin").first()
        if not main_admin:
            main_admin = User(
                username="litho_main_admin",
                email="litho_admin@aquasense.test",
                full_name="Lithology Master Admin",
                hashed_password=hash_password("MasterPass@2026"),
                role="MAIN_ADMIN",
                is_active=True,
            )
            session.add(main_admin)
            session.commit()
            session.refresh(main_admin)

        # 2. Subadmin 1 (e.g. North Basin)
        sub1 = session.query(User).filter(User.username == "litho_sub1").first()
        if not sub1:
            sub1 = User(
                username="litho_sub1",
                email="litho_sub1@aquasense.test",
                full_name="North Hydrogeologist",
                hashed_password=hash_password("Sub1Pass@2026"),
                role="SUBADMIN",
                is_active=True,
            )
            session.add(sub1)
            session.commit()
            session.refresh(sub1)

        # 3. Subadmin 2 (e.g. South Basin)
        sub2 = session.query(User).filter(User.username == "litho_sub2").first()
        if not sub2:
            sub2 = User(
                username="litho_sub2",
                email="litho_sub2@aquasense.test",
                full_name="South Hydrogeologist",
                hashed_password=hash_password("Sub2Pass@2026"),
                role="SUBADMIN",
                is_active=True,
            )
            session.add(sub2)
            session.commit()
            session.refresh(sub2)

        # 4. Station created by Subadmin 1
        well1 = session.query(Well).filter(Well.id == "WELL-LITHO-01").first()
        if not well1:
            well1 = Well(
                id="WELL-LITHO-01",
                name="North Alluvial Research Borehole",
                latitude=26.8467,
                longitude=80.9462,
                country="India",
                state="Uttar Pradesh",
                district="Lucknow",
                city="Lucknow",
                total_depth_m=60.0,
                created_by=sub1.id,
                is_active=True,
            )
            session.add(well1)

        # 5. Station created by Subadmin 2
        well2 = session.query(Well).filter(Well.id == "WELL-LITHO-02").first()
        if not well2:
            well2 = Well(
                id="WELL-LITHO-02",
                name="South Granite Monitoring Bore",
                latitude=22.8046,
                longitude=86.2029,
                country="India",
                state="Jharkhand",
                district="East Singhbhum",
                city="Jamshedpur",
                total_depth_m=100.0,
                created_by=sub2.id,
                is_active=True,
            )
            session.add(well2)

        # Clean any existing lithology layers for these test stations
        session.query(LithologyLayer).filter(
            LithologyLayer.well_id.in_(["WELL-LITHO-01", "WELL-LITHO-02"])
        ).delete(synchronize_session=False)

        session.commit()
    finally:
        session.close()


def auth_headers(username: str) -> dict:
    token = create_session_token(username)
    return {"Authorization": f"Bearer {token}"}


# ─── 1. MIGRATION & EXISTING WELL INTEGRITY ───────────────────────────────────

def test_lithology_migration_and_existing_wells_integrity():
    """Verify that wells without lithology records continue working normally."""
    res = client.get("/api/wells/WELL-LITHO-01/lithology")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    profile_res = client.get("/api/wells/WELL-LITHO-01/lithology/profile")
    assert profile_res.status_code == 200
    data = profile_res.json()
    assert data["well_id"] == "WELL-LITHO-01"
    assert data["layer_count"] == 0
    assert data["total_logged_depth_m"] == 0.0
    assert data["stratigraphic_column"] == []


# ─── 2. CRUD OPERATIONS (MAIN ADMIN & SUBADMIN) ───────────────────────────────

def test_lithology_crud_lifecycle():
    """Test full CRUD lifecycle of lithology layers."""
    headers = auth_headers("litho_sub1")
    well_id = "WELL-LITHO-01"

    # 1. Create topsoil layer (0.0 to 1.5m)
    create_payload = {
        "from_depth_m": 0.0,
        "to_depth_m": 1.5,
        "material_type": "topsoil",
        "description": "Organic rich dark brown surface loam",
        "confidence_level": "HIGH",
        "aquifer_indicator": False,
        "source_reference": "BH-01-LOG",
    }
    create_res = client.post(f"/api/wells/{well_id}/lithology", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    layer1 = create_res.json()
    layer1_id = layer1["id"]
    assert layer1["well_id"] == well_id
    assert layer1["from_depth_m"] == 0.0
    assert layer1["to_depth_m"] == 1.5
    assert layer1["thickness_m"] == 1.5
    assert layer1["material_type"] == "topsoil"
    assert layer1["color_code"] == "#4A3525"  # Automatically assigned standard color

    # 2. Retrieve by ID
    get_res = client.get(f"/api/wells/{well_id}/lithology/{layer1_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == layer1_id

    # 3. Update layer
    update_payload = {
        "description": "Updated: Organic silty loam with plant rootlets",
        "color_code": "#553311",
    }
    update_res = client.put(f"/api/wells/{well_id}/lithology/{layer1_id}", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Updated: Organic silty loam with plant rootlets"
    assert update_res.json()["color_code"] == "#553311"

    # 4. Create second layer touching boundary (1.5m to 6.0m - Sand)
    create_payload2 = {
        "from_depth_m": 1.5,
        "to_depth_m": 6.0,
        "material_type": "sand",
        "description": "Medium grained yellow quartz sand; moist",
        "aquifer_indicator": True,
    }
    create_res2 = client.post(f"/api/wells/{well_id}/lithology", json=create_payload2, headers=headers)
    assert create_res2.status_code == 201
    layer2 = create_res2.json()
    layer2_id = layer2["id"]

    # 5. List layers
    list_res = client.get(f"/api/wells/{well_id}/lithology")
    assert list_res.status_code == 200
    layers = list_res.json()
    assert len(layers) >= 2
    assert layers[0]["from_depth_m"] <= layers[1]["from_depth_m"]

    # 6. Delete layer 2
    del_res = client.delete(f"/api/wells/{well_id}/lithology/{layer2_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify deleted
    get_deleted = client.get(f"/api/wells/{well_id}/lithology/{layer2_id}")
    assert get_deleted.status_code == 404


# ─── 3. VALIDATIONS (DEPTH BOUNDS, NAN, OVERLAPS, GAPS) ───────────────────────

def test_negative_depth_rejected():
    """Negative start depth must be rejected."""
    headers = auth_headers("litho_sub1")
    payload = {
        "from_depth_m": -2.0,
        "to_depth_m": 5.0,
        "material_type": "sand",
    }
    res = client.post("/api/wells/WELL-LITHO-01/lithology", json=payload, headers=headers)
    assert res.status_code in (400, 422)


def test_inverted_depth_rejected():
    """to_depth_m <= from_depth_m must be rejected."""
    headers = auth_headers("litho_sub1")
    payload = {
        "from_depth_m": 10.0,
        "to_depth_m": 8.0,
        "material_type": "clay",
    }
    res = client.post("/api/wells/WELL-LITHO-01/lithology", json=payload, headers=headers)
    assert res.status_code in (400, 422)

    # Equal depth
    payload["to_depth_m"] = 10.0
    res_eq = client.post("/api/wells/WELL-LITHO-01/lithology", json=payload, headers=headers)
    assert res_eq.status_code in (400, 422)


def test_overlap_prevention():
    """Overlapping depth intervals must be rejected by default."""
    headers = auth_headers("litho_sub1")
    well_id = "WELL-LITHO-01"

    # Clean existing layers for this test
    layers = client.get(f"/api/wells/{well_id}/lithology").json()
    for l in layers:
        client.delete(f"/api/wells/{well_id}/lithology/{l['id']}", headers=headers)

    # Create base layer: 10.0m to 20.0m (Sandstone)
    base = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 10.0, "to_depth_m": 20.0, "material_type": "sandstone"},
        headers=headers,
    )
    assert base.status_code == 201

    # Overlap Scenario A: completely inside (12m - 18m)
    res_inside = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 12.0, "to_depth_m": 18.0, "material_type": "clay"},
        headers=headers,
    )
    assert res_inside.status_code == 400
    assert "overlap" in res_inside.json()["detail"].lower()

    # Overlap Scenario B: overlapping top boundary (8m - 15m)
    res_top = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 8.0, "to_depth_m": 15.0, "material_type": "clay"},
        headers=headers,
    )
    assert res_top.status_code == 400

    # Overlap Scenario C: overlapping bottom boundary (18m - 25m)
    res_bottom = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 18.0, "to_depth_m": 25.0, "material_type": "clay"},
        headers=headers,
    )
    assert res_bottom.status_code == 400

    # Non-overlapping adjacent boundary: touching exactly at 20.0m (20.0m to 30.0m)
    res_adjacent = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 20.0, "to_depth_m": 30.0, "material_type": "granite"},
        headers=headers,
    )
    assert res_adjacent.status_code == 201


def test_gaps_allowed_and_reported_in_profile():
    """Gaps between logged intervals are valid and calculated in geological profile."""
    headers = auth_headers("litho_sub1")
    well_id = "WELL-LITHO-01"

    # Clean existing layers
    layers = client.get(f"/api/wells/{well_id}/lithology").json()
    for l in layers:
        client.delete(f"/api/wells/{well_id}/lithology/{l['id']}", headers=headers)

    # Layer 1: 0m to 5m
    client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 0.0, "to_depth_m": 5.0, "material_type": "topsoil"},
        headers=headers,
    )

    # Layer 2: 15m to 25m (Intentional gap between 5m and 15m)
    client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 15.0, "to_depth_m": 25.0, "material_type": "sandstone"},
        headers=headers,
    )

    profile_res = client.get(f"/api/wells/{well_id}/lithology/profile")
    assert profile_res.status_code == 200
    data = profile_res.json()
    assert data["layer_count"] == 2
    assert data["total_logged_depth_m"] == 25.0
    assert data["logged_thickness_m"] == 15.0  # 5m + 10m
    assert len(data["gaps"]) == 1
    assert data["gaps"][0]["from_depth_m"] == 5.0
    assert data["gaps"][0]["to_depth_m"] == 15.0
    assert data["gaps"][0]["length_m"] == 10.0


def test_well_total_depth_policy():
    """Intervals exceeding documented well total depth must be rejected."""
    headers = auth_headers("litho_sub1")
    well_id = "WELL-LITHO-01"  # total_depth_m = 60.0

    # Layer ending at 75m (> 60m total depth)
    res = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 50.0, "to_depth_m": 75.0, "material_type": "granite"},
        headers=headers,
    )
    assert res.status_code == 400
    assert "exceeds" in res.json()["detail"].lower()


# ─── 4. RBAC & PERMISSION RULES ───────────────────────────────────────────────

def test_rbac_subadmin_cannot_modify_other_subadmin_lithology():
    """
    Subadmin 2 must be blocked (403 Forbidden) when attempting to create,
    update, or delete lithology layers for Subadmin 1's well.
    """
    well1_id = "WELL-LITHO-01"  # Owned by Subadmin 1
    sub2_headers = auth_headers("litho_sub2")

    # 1. Subadmin 2 CAN read Subadmin 1's lithology
    read_res = client.get(f"/api/wells/{well1_id}/lithology")
    assert read_res.status_code == 200

    profile_res = client.get(f"/api/wells/{well1_id}/lithology/profile")
    assert profile_res.status_code == 200

    # 2. Subadmin 2 CANNOT create layer on Subadmin 1's well
    create_res = client.post(
        f"/api/wells/{well1_id}/lithology",
        json={"from_depth_m": 30.0, "to_depth_m": 35.0, "material_type": "clay"},
        headers=sub2_headers,
    )
    assert create_res.status_code == 403
    assert "permission" in create_res.json()["detail"].lower()

    # Get an existing layer on well 1
    layers = client.get(f"/api/wells/{well1_id}/lithology").json()
    assert len(layers) > 0
    layer_id = layers[0]["id"]

    # 3. Subadmin 2 CANNOT update Subadmin 1's layer
    update_res = client.put(
        f"/api/wells/{well1_id}/lithology/{layer_id}",
        json={"description": "Hacked description"},
        headers=sub2_headers,
    )
    assert update_res.status_code == 403

    # 4. Subadmin 2 CANNOT delete Subadmin 1's layer
    del_res = client.delete(
        f"/api/wells/{well1_id}/lithology/{layer_id}",
        headers=sub2_headers,
    )
    assert del_res.status_code == 403


def test_rbac_main_admin_can_manage_any_well_lithology():
    """Main Admin has authority to create, update, and delete lithology for ANY well."""
    admin_headers = auth_headers("litho_main_admin")
    well1_id = "WELL-LITHO-01"

    # Main Admin creates layer on Subadmin 1's well
    create_res = client.post(
        f"/api/wells/{well1_id}/lithology",
        json={
            "from_depth_m": 35.0,
            "to_depth_m": 42.0,
            "material_type": "fractured_rock",
            "description": "Admin verified aquifer zone",
            "aquifer_indicator": True,
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    layer_id = create_res.json()["id"]

    # Main Admin updates layer
    update_res = client.put(
        f"/api/wells/{well1_id}/lithology/{layer_id}",
        json={"description": "Admin updated description"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Admin updated description"

    # Main Admin deletes layer
    del_res = client.delete(
        f"/api/wells/{well1_id}/lithology/{layer_id}",
        headers=admin_headers,
    )
    assert del_res.status_code == 200


def test_unauthenticated_mutations_blocked():
    """Unauthenticated requests to mutating endpoints must be blocked with 401."""
    well_id = "WELL-LITHO-01"
    create_res = client.post(
        f"/api/wells/{well_id}/lithology",
        json={"from_depth_m": 25.0, "to_depth_m": 28.0, "material_type": "silt"},
    )
    assert create_res.status_code == 401


def test_subadmin_cannot_bypass_restrictions_with_mismatched_well_or_layer_id():
    """
    Subadmins cannot bypass restrictions by supplying their own well ID
    with a layer ID that belongs to another subadmin's station.
    """
    sub1_headers = auth_headers("litho_sub1")
    sub2_headers = auth_headers("litho_sub2")
    well1_id = "WELL-LITHO-01"  # Owned by Subadmin 1
    well2_id = "WELL-LITHO-02"  # Owned by Subadmin 2

    # Subadmin 1 creates a layer on WELL-LITHO-01
    res1 = client.post(
        f"/api/wells/{well1_id}/lithology",
        json={"from_depth_m": 43.0, "to_depth_m": 48.0, "material_type": "sand"},
        headers=sub1_headers,
    )
    assert res1.status_code == 201
    layer1_id = res1.json()["id"]

    # Subadmin 2 attempts to modify Subadmin 1's layer by targeting their own well (WELL-LITHO-02)
    tamper_update = client.put(
        f"/api/wells/{well2_id}/lithology/{layer1_id}",
        json={"description": "Hacked layer description"},
        headers=sub2_headers,
    )
    assert tamper_update.status_code == 400
    assert "does not belong" in tamper_update.json()["detail"].lower()

    # Subadmin 2 attempts to delete Subadmin 1's layer via WELL-LITHO-02
    tamper_delete = client.delete(
        f"/api/wells/{well2_id}/lithology/{layer1_id}",
        headers=sub2_headers,
    )
    assert tamper_delete.status_code == 400
    assert "does not belong" in tamper_delete.json()["detail"].lower()

    # Cleanup layer1
    client.delete(f"/api/wells/{well1_id}/lithology/{layer1_id}", headers=sub1_headers)


def test_creation_and_update_audit_fields_populated():
    """Creation and update audit user IDs must be reliably tracked on backend."""
    admin_headers = auth_headers("litho_main_admin")
    sub1_headers = auth_headers("litho_sub1")
    well1_id = "WELL-LITHO-01"

    # Subadmin 1 creates a layer
    create_res = client.post(
        f"/api/wells/{well1_id}/lithology",
        json={"from_depth_m": 44.0, "to_depth_m": 49.0, "material_type": "limestone"},
        headers=sub1_headers,
    )
    assert create_res.status_code == 201
    data = create_res.json()
    layer_id = data["id"]
    assert data["created_by_user_id"] is not None
    assert data["updated_by_user_id"] is not None

    # Main Admin updates the layer
    update_res = client.put(
        f"/api/wells/{well1_id}/lithology/{layer_id}",
        json={"description": "Audited by Main Admin"},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    up_data = update_res.json()
    assert up_data["created_by_user_id"] == data["created_by_user_id"]
    assert up_data["updated_by_user_id"] != data["created_by_user_id"]

    # Cleanup
    client.delete(f"/api/wells/{well1_id}/lithology/{layer_id}", headers=admin_headers)


# ─── 5. DEMO SEED ACTION INTEGRITY ───────────────────────────────────────────

def test_demo_stratigraphy_seed_explicit_action():
    """Demo seed must explicitly label records as illustrative_demo."""
    well2_id = "WELL-LITHO-02"
    headers = auth_headers("litho_sub2")

    seed_res = client.post(f"/api/wells/{well2_id}/lithology/seed-demo", headers=headers)
    assert seed_res.status_code == 201
    demo_layers = seed_res.json()
    assert len(demo_layers) >= 5
    for l in demo_layers:
        assert l["data_source"] == "illustrative_demo"
        assert "demo" in l["source_reference"].lower()

    # Fetch profile
    profile_res = client.get(f"/api/wells/{well2_id}/lithology/profile")
    assert profile_res.status_code == 200
    profile = profile_res.json()
    assert profile["has_aquifer_layer"] is True
    assert profile["total_logged_depth_m"] >= 30.0
