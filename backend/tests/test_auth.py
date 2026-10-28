import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_successful_registration(async_client: AsyncClient):
    payload = {
        "full_name": "Test Engineer",
        "email": "engineer@carboniq.org",
        "password": "Password123!",
        "workspace_name": "Clean Tech Campus",
    }
    response = await async_client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "engineer@carboniq.org"
    assert data["user"]["full_name"] == "Test Engineer"
    assert data["user"]["workspace_name"] == "Clean Tech Campus"
    assert len(data["user"]["workspace_id"]) > 0


@pytest.mark.asyncio
async def test_duplicate_email_rejection(async_client: AsyncClient):
    payload = {
        "full_name": "Primary User",
        "email": "duplicate@carboniq.org",
        "password": "Password123!",
    }
    r1 = await async_client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    # Second registration with case variation of the same email
    payload_dup = {
        "full_name": "Imposter User",
        "email": "DUPLICATE@carboniq.org",
        "password": "Password123!",
    }
    r2 = await async_client.post("/api/auth/register", json=payload_dup)
    assert r2.status_code == 409
    assert "already exists" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_successful_login(async_client: AsyncClient):
    reg = {
        "full_name": "Login User",
        "email": "login@carboniq.org",
        "password": "CorrectPassword123!",
    }
    await async_client.post("/api/auth/register", json=reg)

    login_req = {
        "email": "login@carboniq.org",
        "password": "CorrectPassword123!",
    }
    response = await async_client.post("/api/auth/login", json=login_req)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login@carboniq.org"


@pytest.mark.asyncio
async def test_invalid_password_rejection(async_client: AsyncClient):
    reg = {
        "full_name": "Protected User",
        "email": "protected@carboniq.org",
        "password": "CorrectPassword123!",
    }
    await async_client.post("/api/auth/register", json=reg)

    bad_login = {
        "email": "protected@carboniq.org",
        "password": "WrongPassword999!",
    }
    response = await async_client.post("/api/auth/login", json=bad_login)
    assert response.status_code == 401
    assert "invalid email address or password" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_protected_endpoint_me(async_client: AsyncClient, auth_header_helper):
    reg = {
        "full_name": "Me User",
        "email": "me@carboniq.org",
        "password": "Password123!",
    }
    r_reg = await async_client.post("/api/auth/register", json=reg)
    token = r_reg.json()["access_token"]

    # Authorized request
    headers = auth_header_helper(token)
    r_me = await async_client.get("/api/auth/me", headers=headers)
    assert r_me.status_code == 200
    data = r_me.json()
    assert data["email"] == "me@carboniq.org"
    assert data["full_name"] == "Me User"

    # Unauthorized request (no token)
    r_unauth = await async_client.get("/api/auth/me")
    assert r_unauth.status_code == 401

    # Unauthorized request (tampered token)
    r_bad_token = await async_client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token.value"})
    assert r_bad_token.status_code == 401


@pytest.mark.asyncio
async def test_account_type_registration_and_persistence(async_client: AsyncClient, auth_header_helper):
    # 1. College registration
    college_payload = {
        "full_name": "Dean of Campus",
        "email": "dean@reva.edu.in",
        "password": "Password123!",
        "account_type": "college",
        "workspace_name": "REVA University",
    }
    r_col = await async_client.post("/api/auth/register", json=college_payload)
    assert r_col.status_code == 201
    data_col = r_col.json()
    assert data_col["user"]["account_type"] == "college"

    # Login and verify account_type returned
    r_login = await async_client.post("/api/auth/login", json={"email": "dean@reva.edu.in", "password": "Password123!"})
    assert r_login.status_code == 200
    assert r_login.json()["user"]["account_type"] == "college"

    # Verify /me endpoint
    headers = auth_header_helper(r_login.json()["access_token"])
    r_me = await async_client.get("/api/auth/me", headers=headers)
    assert r_me.status_code == 200
    assert r_me.json()["account_type"] == "college"

    # 2. Organization registration
    org_payload = {
        "full_name": "CSR Director",
        "email": "csr@corp.org",
        "password": "Password123!",
        "account_type": "organization",
    }
    r_org = await async_client.post("/api/auth/register", json=org_payload)
    assert r_org.status_code == 201
    assert r_org.json()["user"]["account_type"] == "organization"


@pytest.mark.asyncio
async def test_invalid_account_type_rejection(async_client: AsyncClient):
    bad_payload = {
        "full_name": "Hacker",
        "email": "hacker@carboniq.org",
        "password": "Password123!",
        "account_type": "admin_super_user",  # Invalid role
    }
    r = await async_client.post("/api/auth/register", json=bad_payload)
    assert r.status_code == 422
