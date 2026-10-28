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
