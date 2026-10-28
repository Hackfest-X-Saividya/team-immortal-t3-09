import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_user_token(async_client: AsyncClient) -> str:
    payload = {
        "full_name": "Fleet Manager",
        "email": "fleet@carboniq.org",
        "password": "Password123!",
        "account_type": "organization",
    }
    res = await async_client.post("/api/auth/register", json=payload)
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_transportation_actual_fuel_calculation(
    async_client: AsyncClient,
    auth_user_token: str,
    auth_header_helper,
):
    headers = auth_header_helper(auth_user_token)

    # Actual fuel method: 100 L Diesel × 2.68 kg CO2e/L = 268.0 kg CO2e
    payload = {
        "date": "2026-03-15",
        "mode": "Bus",
        "distance_km": 450.0,
        "fuel_type": "Diesel",
        "fuel_consumed_liters": 100.0,
        "fuel_efficiency_km_per_l": 4.5,  # Provided alongside but MUST NOT double count!
        "fuel_expenditure_inr": 9450.0,
        "vehicle_id": "BUS-01",
    }
    r = await async_client.post("/api/transportation", json=payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["calculation_method"] == "actual_fuel"
    assert data["calculated_emissions_kg"] == 268.0
    assert data["fuel_consumed_liters"] == 100.0


@pytest.mark.asyncio
async def test_transportation_estimated_fuel_calculation(
    async_client: AsyncClient,
    auth_user_token: str,
    auth_header_helper,
):
    headers = auth_header_helper(auth_user_token)

    # Distance + Efficiency method: 450 km ÷ 4.5 km/L = 100 L Diesel -> 100 × 2.68 = 268.0 kg CO2e
    payload = {
        "date": "2026-03-16",
        "mode": "Bus",
        "distance_km": 450.0,
        "fuel_type": "Diesel",
        "fuel_consumed_liters": None,  # Actual fuel missing
        "fuel_efficiency_km_per_l": 4.5,
    }
    r = await async_client.post("/api/transportation", json=payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["calculation_method"] == "distance_efficiency_estimate"
    assert data["calculated_emissions_kg"] == 268.0


@pytest.mark.asyncio
async def test_transportation_missing_data_handling(
    async_client: AsyncClient,
    auth_user_token: str,
    auth_header_helper,
):
    headers = auth_header_helper(auth_user_token)

    # When both actual fuel and efficiency are missing, emissions cannot be calculated
    payload = {
        "date": "2026-03-17",
        "mode": "Car",
        "distance_km": 120.0,
        "fuel_consumed_liters": None,
        "fuel_efficiency_km_per_l": None,
    }
    r = await async_client.post("/api/transportation", json=payload, headers=headers)
    assert r.status_code == 201
    data = r.json()
    assert data["calculation_method"] == "uncalculated"
    assert data["calculated_emissions_kg"] == 0.0


@pytest.mark.asyncio
async def test_transportation_crud_and_summary(
    async_client: AsyncClient,
    auth_user_token: str,
    auth_header_helper,
):
    headers = auth_header_helper(auth_user_token)

    # Create
    create_payload = {
        "date": "2026-03-10",
        "mode": "Fleet Van",
        "distance_km": 200.0,
        "fuel_type": "Petrol",
        "fuel_consumed_liters": 20.0,
        "fuel_expenditure_inr": 2084.0,
    }
    r_create = await async_client.post("/api/transportation", json=create_payload, headers=headers)
    assert r_create.status_code == 201
    rec_id = r_create.json()["id"]

    # Read
    r_get = await async_client.get(f"/api/transportation/{rec_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["mode"] == "Fleet Van"

    # Update
    r_update = await async_client.put(
        f"/api/transportation/{rec_id}",
        json={"distance_km": 250.0},
        headers=headers,
    )
    assert r_update.status_code == 200
    assert r_update.json()["distance_km"] == 250.0

    # Summary
    r_summary = await async_client.get("/api/transportation/summary", headers=headers)
    assert r_summary.status_code == 200
    summary = r_summary.json()
    assert summary["total_distance_km"] == 250.0
    assert summary["record_count"] == 1

    # Delete
    r_del = await async_client.delete(f"/api/transportation/{rec_id}", headers=headers)
    assert r_del.status_code == 200
