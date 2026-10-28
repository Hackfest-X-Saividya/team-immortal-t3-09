import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_workspace_isolation_read_protection(
    async_client: AsyncClient,
    auth_header_helper,
):
    # Register User A
    r_a = await async_client.post(
        "/api/auth/register",
        json={"full_name": "User Alpha", "email": "alpha@carboniq.org", "password": "Password123!"},
    )
    token_a = r_a.json()["access_token"]
    headers_a = auth_header_helper(token_a)

    # Register User B
    r_b = await async_client.post(
        "/api/auth/register",
        json={"full_name": "User Beta", "email": "beta@carboniq.org", "password": "Password123!"},
    )
    token_b = r_b.json()["access_token"]
    headers_b = auth_header_helper(token_b)

    # User A creates a confidential electricity record
    r_create = await async_client.post(
        "/api/electricity",
        json={"reporting_month": "2026-03", "consumption_kwh": 5000.0, "notes": "Classified Lab Alpha"},
        headers=headers_a,
    )
    assert r_create.status_code == 201
    record_id = r_create.json()["id"]

    # User B lists electricity records: must NOT see User A's record!
    r_b_list = await async_client.get("/api/electricity", headers=headers_b)
    assert r_b_list.status_code == 200
    assert len(r_b_list.json()) == 0

    # User B tries to read User A's record by direct ID: must return 404 (Not Found in User B's workspace)
    r_b_direct = await async_client.get(f"/api/electricity/{record_id}", headers=headers_b)
    assert r_b_direct.status_code == 404

    # User B tries to update User A's record: must return 404
    r_b_up = await async_client.put(
        f"/api/electricity/{record_id}",
        json={"consumption_kwh": 10.0},
        headers=headers_b,
    )
    assert r_b_up.status_code == 404

    # User B tries to delete User A's record: must return 404
    r_b_del = await async_client.delete(f"/api/electricity/{record_id}", headers=headers_b)
    assert r_b_del.status_code == 404

    # Verify User A's record was untouched
    r_a_check = await async_client.get(f"/api/electricity/{record_id}", headers=headers_a)
    assert r_a_check.status_code == 200
    assert r_a_check.json()["consumption_kwh"] == 5000.0


@pytest.mark.asyncio
async def test_unauthenticated_requests_blocked(async_client: AsyncClient):
    protected_paths = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/electricity"),
        ("POST", "/api/electricity"),
        ("GET", "/api/electricity/summary"),
        ("GET", "/api/transportation"),
        ("POST", "/api/transportation"),
        ("GET", "/api/transportation/routes"),
        ("POST", "/api/transportation/optimize"),
        ("GET", "/api/waste"),
        ("POST", "/api/waste"),
        ("GET", "/api/dashboard/summary"),
        ("POST", "/api/ai/electricity"),
        ("POST", "/api/simulator/electricity"),
        ("GET", "/api/reports/emissions"),
    ]

    for method, path in protected_paths:
        if method == "GET":
            resp = await async_client.get(path)
        else:
            resp = await async_client.post(path, json={})
        assert resp.status_code == 401, f"Expected 401 for {method} {path}, got {resp.status_code}"


@pytest.mark.asyncio
async def test_individual_transportation_forbidden_and_rbac(
    async_client: AsyncClient,
    auth_header_helper,
):
    # 1. Register as Individual
    r_ind = await async_client.post(
        "/api/auth/register",
        json={"full_name": "Student Individual", "email": "student@carboniq.org", "password": "Password123!", "account_type": "individual"},
    )
    assert r_ind.status_code == 201
    headers_ind = auth_header_helper(r_ind.json()["access_token"])

    # Individual CAN access electricity and waste
    r_elec = await async_client.get("/api/electricity", headers=headers_ind)
    assert r_elec.status_code == 200

    r_waste = await async_client.get("/api/waste", headers=headers_ind)
    assert r_waste.status_code == 200

    # Individual MUST BE FORBIDDEN (403) from accessing Transportation and Bus Routes
    restricted_transport_endpoints = [
        ("GET", "/api/transportation"),
        ("POST", "/api/transportation"),
        ("GET", "/api/transportation/summary"),
        ("GET", "/api/transportation/routes"),
        ("POST", "/api/transportation/routes"),
        ("POST", "/api/transportation/optimize"),
        ("POST", "/api/ai/transportation"),
    ]

    for method, path in restricted_transport_endpoints:
        if method == "GET":
            resp = await async_client.get(path, headers=headers_ind)
        else:
            resp = await async_client.post(path, json={"question": "optimize?"} if "ai" in path else {}, headers=headers_ind)
        assert resp.status_code == 403, f"Expected 403 Forbidden for Individual on {method} {path}, got {resp.status_code}"
        assert "restricted" in resp.json()["detail"].lower()

    # 2. Register as College
    r_col = await async_client.post(
        "/api/auth/register",
        json={"full_name": "Campus Lead", "email": "campus@carboniq.org", "password": "Password123!", "account_type": "college"},
    )
    headers_col = auth_header_helper(r_col.json()["access_token"])

    # College CAN access transportation
    r_col_trans = await async_client.get("/api/transportation", headers=headers_col)
    assert r_col_trans.status_code == 200

    r_col_routes = await async_client.get("/api/transportation/routes", headers=headers_col)
    assert r_col_routes.status_code == 200

    # 3. Register as Organization
    r_org = await async_client.post(
        "/api/auth/register",
        json={"full_name": "Org Admin", "email": "org@carboniq.org", "password": "Password123!", "account_type": "organization"},
    )
    headers_org = auth_header_helper(r_org.json()["access_token"])

    # Organization CAN access transportation
    r_org_trans = await async_client.get("/api/transportation", headers=headers_org)
    assert r_org_trans.status_code == 200

