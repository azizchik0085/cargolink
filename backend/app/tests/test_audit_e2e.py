import httpx
import pytest

BASE_URL = "http://localhost:8000"

def test_full_system_audit_e2e():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. System Health
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["zero_commission_policy"] is True

        # 2. Authentication: Driver Login
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998934445566",
            "password": "driver123"
        })
        assert res.status_code == 200
        driver_token = res.json()["access_token"]
        driver_id = res.json()["user"]["id"]
        assert res.json()["user"]["role"] == "DRIVER"

        # 3. Authentication: Shipper/Logistics Login
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998901112233",
            "password": "shipper123"
        })
        assert res.status_code == 200
        shipper_token = res.json()["access_token"]
        shipper_id = res.json()["user"]["id"]
        assert res.json()["user"]["role"] == "LOGISTICS_COMPANY_OWNER"

        # 4. Driver Profile Check (/auth/me)
        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {driver_token}"})
        assert res.status_code == 200
        assert res.json()["driver_profile"] is not None

        # 5. Shipper Profile Check (/auth/me) with Company and Active Subscription
        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {shipper_token}"})
        assert res.status_code == 200
        assert res.json()["company"] is not None
        assert res.json()["company"]["subscription"]["plan_code"] in ["BUSINESS", "ENTERPRISE"]

        # 6. Cargo Marketplace: List Loads
        res = client.get("/api/v1/loads/")
        assert res.status_code == 200
        loads = res.json()
        assert len(loads) > 0

        # 7. Cargo Marketplace: Publish New Load by Shipper
        new_load_data = {
            "origin_country": "Uzbekistan",
            "origin_city": "Bukhara",
            "destination_country": "Kazakhstan",
            "destination_city": "Shymkent",
            "loading_date": "2026-11-10T10:00:00",
            "cargo_title": "E2E Audit Test Cargo (Textiles)",
            "cargo_category": "Industrial Goods",
            "weight_kg": 20000.0,
            "volume_m3": 86.0,
            "required_vehicle_type": "Curtain-sided truck (Tent)",
            "price": 1750.0,
            "currency": "USD",
            "contact_name": "Silk Road Audit Dispatcher",
            "contact_phone": "+998901112233",
            "description": "Automated audit test cargo item."
        }
        res = client.post(
            "/api/v1/loads/", 
            json=new_load_data,
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        created_load_id = res.json()["load_id"]

        # 8. Vehicle Marketplace: Register Vehicle (100% FREE for Drivers)
        vehicle_data = {
            "vehicle_type": "Curtain-sided truck (Tent)",
            "make": "MAN",
            "model": "TGX 18.480",
            "plate_number": "80 A 999 BA",
            "max_weight_tons": 22.0,
            "max_volume_m3": 90.0,
            "current_country": "Uzbekistan",
            "current_city": "Bukhara",
            "preferred_destinations": "Kazakhstan, Russia"
        }
        res = client.post(
            "/api/v1/vehicles/",
            json=vehicle_data,
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        created_vehicle_id = res.json()["vehicle_id"]

        # 9. Smart Matching Engine
        res = client.get(f"/api/v1/search/match-for-vehicle/{created_vehicle_id}")
        assert res.status_code == 200
        matches = res.json()
        assert len(matches) > 0
        assert matches[0]["relevance_score"] >= 50

        # 10. Offers & Negotiation Workflow: Driver submits price offer (0% Commission)
        res = client.post(
            "/api/v1/offers/",
            json={
                "load_id": created_load_id,
                "vehicle_id": created_vehicle_id,
                "proposed_price": 1700.0,
                "currency": "USD",
                "pickup_date": "2026-11-10T12:00:00",
                "comment": "Audit test offer: ready to load on time."
            },
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True
        offer_id = res.json()["offer_id"]

        # 11. Logistics Reviews Received Offers
        res = client.get(
            f"/api/v1/offers/load/{created_load_id}",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        received_offers = res.json()
        assert any(o["id"] == offer_id for o in received_offers)

        # 12. Logistics Accepts Offer
        res = client.put(
            f"/api/v1/offers/{offer_id}/status?action=ACCEPT",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert "ACCEPTED" in res.json()["message"]

        # 13. Notifications: Driver receives notification about accepted offer
        res = client.get(
            "/api/v1/notifications/",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 200
        notifications = res.json()
        assert len(notifications) > 0

        # Mark notification as read
        notif_id = notifications[0]["id"]
        res = client.put(
            f"/api/v1/notifications/{notif_id}/read",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert res.status_code == 200

        # 14. Subscriptions & Billing Engine
        res = client.get("/api/v1/subscriptions/plans")
        assert res.status_code == 200
        plans = res.json()
        assert len(plans) == 4

        # Shipper upgrades subscription to ENTERPRISE
        res = client.post(
            "/api/v1/subscriptions/subscribe",
            json={"plan_code": "ENTERPRISE", "payment_method": "CLICK_TEST"},
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Verify active subscription
        res = client.get(
            "/api/v1/subscriptions/my",
            headers={"Authorization": f"Bearer {shipper_token}"}
        )
        assert res.status_code == 200
        assert res.json()["plan_code"] == "ENTERPRISE"
        assert len(res.json()["invoices"]) > 0

        # 15. Admin Dashboard & Metrics (Super Admin)
        res = client.post("/api/v1/auth/login", json={
            "phone": "+998900000001",
            "password": "admin123"
        })
        assert res.status_code == 200
        admin_token = res.json()["access_token"]

        res = client.get(
            "/api/v1/admin/metrics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200
        metrics = res.json()
        assert metrics["total_users"] > 0
        assert metrics["total_loads"] > 0
        assert metrics["total_vehicles"] > 0
        assert metrics["mrr_uzs"] > 0
        assert metrics["commission_rate"] == "0% (Zero freight commission guarantee)"
