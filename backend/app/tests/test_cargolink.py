import httpx

BASE_URL = "http://localhost:8000"

def test_health():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["app"] == "CARGOLINK"
        assert data["zero_commission_policy"] is True

def test_subscription_plans():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/api/v1/subscriptions/plans")
        assert res.status_code == 200
        plans = res.json()
        codes = [p["code"] for p in plans]
        assert "START" in codes
        assert "STANDARD" in codes
        assert "BUSINESS" in codes
        assert "ENTERPRISE" in codes

def test_loads_listing():
    with httpx.Client(base_url=BASE_URL) as client:
        res = client.get("/api/v1/loads/")
        assert res.status_code == 200
        loads = res.json()
        assert len(loads) > 0

def test_driver_free_access():
    with httpx.Client(base_url=BASE_URL) as client:
        # Driver login
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998934445566",
            "password": "driver123"
        })
        assert res.status_code == 200
        token = res.json()["access_token"]

        # Driver checks vehicle list without paying any subscription
        res_v = client.get("/api/v1/vehicles/", headers={"Authorization": f"Bearer {token}"})
        assert res_v.status_code == 200
