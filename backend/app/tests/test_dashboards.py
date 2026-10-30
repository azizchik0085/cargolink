import httpx
import pytest

BASE_URL = "http://localhost:8000"

def test_dashboards_and_roles_e2e():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Login as Logistics User
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998901112233",
            "password": "shipper123"
        })
        assert res.status_code == 200
        shipper_token = res.json()["access_token"]

        # 2. Login as Driver
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998934445566",
            "password": "driver123"
        })
        assert res.status_code == 200
        driver_token = res.json()["access_token"]
        driver_id = res.json()["user"]["id"]

        # 3. Logistic Dashboard Verification
        res = client.get(
            "/api/v1/dashboard/logistic",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "statistics" in data
        assert "my_loads" in data
        assert data["statistics"]["total_posted_loads"] >= 0
        assert data["profile"]["company_name"] is not None

        # 4. Driver Dashboard Verification
        res = client.get(
            "/api/v1/dashboard/driver",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "statistics" in data
        assert "vehicles" in data
        assert "my_orders" in data
        assert len(data["vehicles"]) >= 0

        # 5. Role-Based Access Control: Driver CANNOT access Logistic Dashboard
        res = client.get(
            "/api/v1/dashboard/logistic",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 403

        # 6. Load Status Lifecycle Audit: Pause / Unpause Load
        loads = client.get("/api/v1/loads/").json()
        assert len(loads) > 0
        first_load_id = loads[0]["id"]

        # Pause
        res = client.put(
            f"/api/v1/dashboard/loads/{first_load_id}/pause",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert "is_paused" in res.json()

        # Unpause
        res = client.put(
            f"/api/v1/dashboard/loads/{first_load_id}/pause",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200

        # 7. Update Load Status through lifecycle with Audit Trail Log
        res = client.put(
            f"/api/v1/dashboard/loads/{first_load_id}/status?new_status=IN_TRANSIT",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Check that load details includes history log
        res = client.get(f"/api/v1/loads/{first_load_id}")
        assert res.status_code == 200
        assert len(res.json()["history"]) > 0

        # 8. Submit Review & Rating After Transport
        res = client.post(
            f"/api/v1/dashboard/reviews?order_id={first_load_id}&target_id={driver_id}&rating=5&comment=Excellent+driver!+On-time+delivery.",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        # 9. Verify Duplicate Review Prevention
        res = client.post(
            f"/api/v1/dashboard/reviews?order_id={first_load_id}&target_id={driver_id}&rating=5",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 400
        assert "already submitted a review" in res.json()["detail"]
