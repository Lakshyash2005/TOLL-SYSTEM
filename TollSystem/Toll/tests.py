from decimal import Decimal
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from django.test import TestCase
from rest_framework import status

from .models import Vehicle, UserProfile
from .models import (
    Vehicle,
    TollPlaza,
    TollRule,
    Wallet,
    TollTransaction,
    UserProfile,
)

from .services import process_toll


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def make_owner(username="owner1", password="testpass123"):
    user = User.objects.create_user(username=username, password=password)
    UserProfile.objects.create(user=user, role=UserProfile.OWNER)
    Wallet.objects.create(user=user, balance=Decimal("500.00"))
    return user


def make_admin(username="admin1", password="testpass123"):
    user = User.objects.create_user(username=username, password=password)
    UserProfile.objects.create(user=user, role=UserProfile.ADMIN)
    Wallet.objects.create(user=user)
    return user


def make_plaza(name="Test Plaza", active=True):
    return TollPlaza.objects.create(name=name, location="Test Location", is_active=active)


def make_rule(plaza, vtype="CAR", amount="80.00", active=True):
    return TollRule.objects.create(
        toll_plaza=plaza,
        vehicle_type=vtype,
        amount=Decimal(amount),
        is_active=active,
    )


def make_vehicle(owner, reg="REG001", rfid="RFID001", vtype="CAR", active=True):
    return Vehicle.objects.create(
        registration_number=reg,
        rfid_tag=rfid,
        vehicle_type=vtype,
        owner=owner,
        is_active=active,
    )


# ─────────────────────────────────────────────
# Service-layer toll processing tests
# ─────────────────────────────────────────────

class TollProcessingTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="testowner", password="testpassword")
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)
        self.vehicle = Vehicle.objects.create(
            registration_number="TEST1234", rfid_tag="TEST-RFID-001",
            vehicle_type="CAR", owner=self.user, is_active=True
        )
        self.plaza = TollPlaza.objects.create(name="Test Toll Plaza", location="Test Location", is_active=True)
        TollRule.objects.create(toll_plaza=self.plaza, vehicle_type="CAR", amount=Decimal("80.00"), is_active=True)
        self.wallet = Wallet.objects.create(user=self.user, balance=Decimal("500.00"))

    def test_successful_toll(self):
        result = process_toll(self.vehicle.rfid_tag, self.plaza)
        self.assertTrue(result["success"])
        self.assertEqual(result["state"], "PASSED")
        self.assertEqual(result["amount"], Decimal("80.00"))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("420.00"))
        txn = TollTransaction.objects.get(vehicle=self.vehicle)
        self.assertEqual(txn.status, "SUCCESS")
        self.assertEqual(txn.state, "PASSED")

    def test_unknown_rfid(self):
        result = process_toll("DOES-NOT-EXIST", self.plaza)
        self.assertFalse(result["success"])
        self.assertEqual(result["state"], "UNKNOWN_RFID")

    def test_insufficient_balance(self):
        self.wallet.balance = Decimal("10.00")
        self.wallet.save()
        result = process_toll(self.vehicle.rfid_tag, self.plaza)
        self.assertFalse(result["success"])
        self.assertEqual(result["state"], "INSUFFICIENT_BALANCE")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("10.00"))
        txn = TollTransaction.objects.get(vehicle=self.vehicle)
        self.assertEqual(txn.status, "FAILED")

    def test_inactive_vehicle_not_processed(self):
        self.vehicle.is_active = False
        self.vehicle.save()
        result = process_toll(self.vehicle.rfid_tag, self.plaza)
        self.assertFalse(result["success"])
        self.assertEqual(result["state"], "UNKNOWN_RFID")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))

    def test_no_toll_rule_returns_failure(self):
        plaza2 = TollPlaza.objects.create(name="No-Rule Plaza", location="Nowhere", is_active=True)
        result = process_toll(self.vehicle.rfid_tag, plaza2)
        self.assertFalse(result["success"])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))


# ─────────────────────────────────────────────
# Vehicle list/create API tests
# ─────────────────────────────────────────────

class VehicleListAPITests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="api_test_owner", password="testpassword")
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)
        self.vehicle = Vehicle.objects.create(
            registration_number="API1234", rfid_tag="API-RFID-001",
            vehicle_type="CAR", owner=self.user, is_active=True
        )

    def test_vehicle_list_returns_vehicles(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/vehicles/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["registration_number"], "API1234")

    def test_create_vehicle(self):
        self.client.force_authenticate(user=self.user)
        data = {"registration_number": "NEW1234", "rfid_tag": "NEW-RFID-001", "vehicle_type": "CAR"}
        response = self.client.post("/api/vehicles/", data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["registration_number"], "NEW1234")
        self.assertEqual(Vehicle.objects.get(registration_number="NEW1234").owner, self.user)

    def test_unauthenticated_user_cannot_list_vehicles(self):
        response = self.client.get("/api/vehicles/")
        self.assertIn(response.status_code, [401, 403])

    def test_create_vehicle_with_invalid_type(self):
        self.client.force_authenticate(user=self.user)
        data = {"registration_number": "INVALID123", "rfid_tag": "INVALID-RFID", "vehicle_type": "PLANE"}
        response = self.client.post("/api/vehicles/", data=data, format="json")
        self.assertEqual(response.status_code, 400)

    def test_staff_cannot_access_owner_vehicle_api(self):
        staff = User.objects.create_user(username="api_test_staff", password="testpass123")
        UserProfile.objects.create(user=staff, role=UserProfile.STAFF)
        self.client.force_authenticate(user=staff)
        response = self.client.get("/api/vehicles/")
        self.assertIn(response.status_code, [401, 403])

    def test_admin_cannot_access_owner_vehicle_api(self):
        admin = make_admin("api_test_admin2")
        self.client.force_authenticate(user=admin)
        response = self.client.get("/api/vehicles/")
        self.assertIn(response.status_code, [401, 403])

    def test_owner_can_only_see_own_vehicles(self):
        other = User.objects.create_user(username="another_owner", password="testpass123")
        UserProfile.objects.create(user=other, role=UserProfile.OWNER)
        Vehicle.objects.create(registration_number="OTHER123", rfid_tag="OTHER-RFID-001",
                               vehicle_type="CAR", owner=other)
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/vehicles/")
        self.assertEqual(response.status_code, 200)
        regs = [v["registration_number"] for v in response.data]
        self.assertIn("API1234", regs)
        self.assertNotIn("OTHER123", regs)

    def test_motorcycle_vehicle_type_accepted(self):
        self.client.force_authenticate(user=self.user)
        data = {"registration_number": "MOTO001", "rfid_tag": "MOTO-RFID-001", "vehicle_type": "MOTORCYCLE"}
        response = self.client.post("/api/vehicles/", data, format="json")
        self.assertEqual(response.status_code, 201)

    def test_owner_can_deactivate_own_vehicle(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.vehicle.refresh_from_db()
        self.assertFalse(self.vehicle.is_active)


# ─────────────────────────────────────────────
# Toll process API tests
# ─────────────────────────────────────────────

class TollProcessAPITests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username="toll_api_owner", password="testpassword")
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)
        self.vehicle = Vehicle.objects.create(
            registration_number="TOLL1234", rfid_tag="TOLL-RFID-001",
            vehicle_type="CAR", owner=self.user, is_active=True
        )
        self.plaza = TollPlaza.objects.create(name="API Test Toll Plaza", location="API Test Location", is_active=True)
        TollRule.objects.create(toll_plaza=self.plaza, vehicle_type="CAR", amount=Decimal("80.00"), is_active=True)
        self.wallet = Wallet.objects.create(user=self.user, balance=Decimal("500.00"))
        self.client.force_authenticate(user=self.user)

    def test_successful_toll_payment(self):
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle.rfid_tag, "toll_plaza_id": self.plaza.id},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["state"], "PASSED")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("420.00"))

    def test_unknown_rfid_does_not_deduct_wallet_balance(self):
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": "UNKNOWN-RFID-999", "toll_plaza_id": self.plaza.id},
            format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))

    def test_insufficient_balance_does_not_deduct_wallet(self):
        self.wallet.balance = Decimal("20.00")
        self.wallet.save()
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle.rfid_tag, "toll_plaza_id": self.plaza.id},
            format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["state"], "INSUFFICIENT_BALANCE")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("20.00"))
        txn = TollTransaction.objects.get(vehicle=self.vehicle, toll_plaza=self.plaza)
        self.assertEqual(txn.status, "FAILED")
        self.assertEqual(txn.state, "INSUFFICIENT_BALANCE")

    def test_unauthenticated_user_cannot_process_toll(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle.rfid_tag, "toll_plaza_id": self.plaza.id},
            format="json"
        )
        self.assertIn(response.status_code, [401, 403])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))
        self.assertEqual(TollTransaction.objects.count(), 0)

    def test_inactive_plaza_rejected(self):
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle.rfid_tag, "toll_plaza_id": 99999},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))

    def test_inactive_vehicle_rejected(self):
        self.vehicle.is_active = False
        self.vehicle.save()
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle.rfid_tag, "toll_plaza_id": self.plaza.id},
            format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))


# ─────────────────────────────────────────────
# Admin API security tests
# ─────────────────────────────────────────────

class AdminAPISecurityTests(APITestCase):

    def setUp(self):
        self.owner = make_owner("sec_owner")
        self.admin = make_admin("sec_admin")
        self.plaza = make_plaza("Security Plaza")
        make_rule(self.plaza)

    def test_owner_cannot_access_admin_stats(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/admin/stats/")
        self.assertIn(response.status_code, [401, 403])

    def test_unauthenticated_cannot_access_admin_stats(self):
        response = self.client.get("/api/admin/stats/")
        self.assertIn(response.status_code, [401, 403])

    def test_admin_can_access_stats(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_users", response.data)
        self.assertIn("total_revenue", response.data)

    def test_owner_cannot_list_admin_users(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/admin/users/")
        self.assertIn(response.status_code, [401, 403])

    def test_admin_can_list_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, 200)

    def test_owner_cannot_create_plaza(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            "/api/admin/plazas/",
            {"name": "Hack Plaza", "location": "Hack City"},
            format="json"
        )
        self.assertIn(response.status_code, [401, 403])

    def test_admin_can_create_plaza(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/plazas/",
            {"name": "New Plaza", "location": "New City", "is_active": True},
            format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(TollPlaza.objects.filter(name="New Plaza").exists())

    def test_admin_can_deactivate_plaza(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/admin/plazas/{self.plaza.id}/",
            {"is_active": False},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.plaza.refresh_from_db()
        self.assertFalse(self.plaza.is_active)

    def test_owner_cannot_create_toll_rule(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            "/api/admin/rules/",
            {"toll_plaza": self.plaza.id, "vehicle_type": "BUS", "amount": "50.00"},
            format="json"
        )
        self.assertIn(response.status_code, [401, 403])

    def test_admin_can_manage_toll_rules(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/rules/",
            {"toll_plaza": self.plaza.id, "vehicle_type": "BUS", "amount": "50.00", "is_active": True},
            format="json"
        )
        self.assertEqual(response.status_code, 201)

    def test_admin_revenue_excludes_failed_transactions(self):
        owner = make_owner("rev_owner")
        vehicle = make_vehicle(owner, "REV001", "RFID-REV-001")
        plaza = make_plaza("Rev Plaza")
        make_rule(plaza, amount="100.00")
        # Create 1 success, 1 failed transaction
        TollTransaction.objects.create(
            vehicle=vehicle, toll_plaza=plaza, amount=Decimal("100.00"),
            status="SUCCESS", state="PASSED"
        )
        TollTransaction.objects.create(
            vehicle=vehicle, toll_plaza=plaza, amount=Decimal("100.00"),
            status="FAILED", state="INSUFFICIENT_BALANCE",
            failure_reason="Insufficient wallet balance"
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/stats/")
        self.assertEqual(response.status_code, 200)
        # Revenue must only count SUCCESS transactions (>=100.00 from this test)
        revenue = Decimal(response.data["total_revenue"])
        self.assertGreaterEqual(revenue, Decimal("100.00"))
        # Range revenue must match success revenue only
        range_rev = Decimal(response.data["range_revenue"])
        self.assertGreaterEqual(range_rev, Decimal("100.00"))
        # Failed transactions counted separately
        self.assertGreaterEqual(response.data["failed_transactions"], 1)

    def test_admin_stats_chart_data_and_plaza_activity(self):
        owner = make_owner("chart_owner")
        vehicle = make_vehicle(owner, "CHART01", "RFID-CHART-01")
        plaza = make_plaza("Chart Plaza")
        make_rule(plaza, amount="60.00")
        TollTransaction.objects.create(
            vehicle=vehicle, toll_plaza=plaza, amount=Decimal("60.00"),
            status="SUCCESS", state="PASSED"
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/stats/?range=7d")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["range"], "7d")
        self.assertEqual(response.data["range_days"], 7)
        self.assertIn("chart_data", response.data)
        self.assertEqual(len(response.data["chart_data"]), 7)
        # Verify chart entry fields
        today_entry = response.data["chart_data"][-1]
        self.assertIn("date", today_entry)
        self.assertIn("label", today_entry)
        self.assertIn("success", today_entry)
        self.assertIn("failed", today_entry)
        self.assertIn("revenue", today_entry)
        # Verify plaza activity breakdown
        self.assertIn("plaza_activity", response.data)
        chart_plaza_summary = next((p for p in response.data["plaza_activity"] if p["id"] == plaza.id), None)
        self.assertIsNotNone(chart_plaza_summary)
        self.assertEqual(chart_plaza_summary["name"], "Chart Plaza")
        self.assertGreaterEqual(chart_plaza_summary["transaction_count"], 1)
        self.assertGreaterEqual(float(chart_plaza_summary["successful_revenue"]), 60.0)

    def test_admin_stats_range_30d(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/stats/?range=30d")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["range"], "30d")
        self.assertEqual(response.data["range_days"], 30)
        self.assertEqual(len(response.data["chart_data"]), 30)

    def test_me_endpoint_returns_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "ADMIN")

    def test_me_endpoint_owner_role(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "OWNER")


# ─────────────────────────────────────────────
# Vehicle detail update tests
# ─────────────────────────────────────────────

class VehicleDetailAPITests(APITestCase):

    def setUp(self):
        self.owner = make_owner("detail_owner")
        self.other = make_owner("other_owner")
        self.vehicle = make_vehicle(self.owner, "DET001", "RFID-DET-001", "CAR", True)

    def test_owner_can_get_own_vehicle(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/vehicles/{self.vehicle.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["registration_number"], "DET001")

    def test_other_owner_cannot_get_vehicle(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.get(f"/api/vehicles/{self.vehicle.id}/")
        self.assertEqual(response.status_code, 404)

    def test_owner_can_update_vehicle_details(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle.id}/",
            {"registration_number": "UPDATED01", "vehicle_type": "TRUCK"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.vehicle.refresh_from_db()
        self.assertEqual(self.vehicle.registration_number, "UPDATED01")
        self.assertEqual(self.vehicle.vehicle_type, "TRUCK")

    def test_other_owner_cannot_update_vehicle(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle.id}/",
            {"registration_number": "HACKED01"},
            format="json"
        )
        self.assertEqual(response.status_code, 404)


# ─────────────────────────────────────────────
# Admin reports and CSV export tests
# ─────────────────────────────────────────────

class AdminReportsAndCSVTests(APITestCase):

    def setUp(self):
        self.owner = make_owner("report_owner")
        self.admin = make_admin("report_admin")
        self.plaza = make_plaza("Report Plaza")
        make_rule(self.plaza, "CAR", "90.00")
        self.vehicle = make_vehicle(self.owner, "REP001", "RFID-REP-001")
        TollTransaction.objects.create(
            vehicle=self.vehicle,
            toll_plaza=self.plaza,
            amount=Decimal("90.00"),
            status="SUCCESS",
            state="PASSED",
        )

    def test_admin_can_access_reports(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/reports/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("by_plaza", response.data)
        self.assertIn("by_vehicle_type", response.data)
        self.assertIn("daily_trend", response.data)
        self.assertIn("success_rate_percent", response.data)
        self.assertEqual(response.data["success_rate_percent"], 100.0)

    def test_owner_cannot_access_reports(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/admin/reports/")
        self.assertIn(response.status_code, [401, 403])

    def test_admin_can_export_csv(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/transactions/export/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        content = response.content.decode("utf-8")
        self.assertIn("Transaction ID", content)
        self.assertIn("REP001", content)
        self.assertIn("Report Plaza", content)

    def test_owner_cannot_export_csv(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get("/api/admin/transactions/export/")
        self.assertIn(response.status_code, [401, 403])

    def test_service_process_toll_inactive_plaza(self):
        inactive_plaza = make_plaza("Inactive Plaza", active=False)
        result = process_toll(self.vehicle.rfid_tag, inactive_plaza)
        self.assertFalse(result["success"])


# ─────────────────────────────────────────────
# User Profile & Security Tests (Level 3)
# ─────────────────────────────────────────────

class UserProfileAndSecurityTests(APITestCase):

    def setUp(self):
        self.password = "InitialPass123!"
        self.user = User.objects.create_user(
            username="profile_user",
            password=self.password,
            email="profile@example.com",
            first_name="Jane",
            last_name="Doe",
        )
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)
        self.token = Token.objects.create(user=self.user)

        self.other_user = User.objects.create_user(
            username="other_user",
            password="OtherPass123!",
            email="other@example.com",
        )
        UserProfile.objects.create(user=self.other_user, role=UserProfile.OWNER)
        self.other_token = Token.objects.create(user=self.other_user)

    def test_get_profile_authenticated(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.get("/api/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "profile_user")
        self.assertEqual(response.data["email"], "profile@example.com")
        self.assertEqual(response.data["role"], "OWNER")
        self.assertTrue(response.data["is_active"])
        self.assertIn("date_joined", response.data)

    def test_get_profile_unauthenticated(self):
        response = self.client.get("/api/me/")
        self.assertIn(response.status_code, [401, 403])

    def test_update_profile_email_and_name(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.patch(
            "/api/me/",
            {"email": "updated@example.com", "first_name": "Janet"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "updated@example.com")
        self.assertEqual(response.data["first_name"], "Janet")
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "updated@example.com")
        self.assertEqual(self.user.first_name, "Janet")

    def test_cannot_escalate_role_via_profile_update(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.patch(
            "/api/me/",
            {"role": "ADMIN", "is_staff": True, "is_superuser": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.userprofile.role, UserProfile.OWNER)
        self.assertFalse(self.user.is_staff)
        self.assertFalse(self.user.is_superuser)

    def test_update_profile_invalid_empty_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.patch(
            "/api/me/",
            {"email": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_update_profile_duplicate_email_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.patch(
            "/api/me/",
            {"email": "other@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_change_password_valid(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        new_pass = "BrandNewSecretPass456!"
        response = self.client.post(
            "/api/password/change/",
            {
                "current_password": self.password,
                "new_password": new_pass,
                "confirm_password": new_pass,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.data)

        # Verify old password no longer works
        old_auth = authenticate(username="profile_user", password=self.password)
        self.assertIsNone(old_auth)

        # Verify new password authenticates
        new_auth = authenticate(username="profile_user", password=new_pass)
        self.assertIsNotNone(new_auth)

    def test_change_password_invalid_current(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post(
            "/api/password/change/",
            {
                "current_password": "WrongPassword999!",
                "new_password": "BrandNewSecretPass456!",
                "confirm_password": "BrandNewSecretPass456!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("current_password", response.data)

    def test_change_password_mismatch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post(
            "/api/password/change/",
            {
                "current_password": self.password,
                "new_password": "BrandNewSecretPass456!",
                "confirm_password": "DifferentPassword789!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_password", response.data)

    def test_change_password_too_short(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post(
            "/api/password/change/",
            {
                "current_password": self.password,
                "new_password": "short",
                "confirm_password": "short",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data)

    def test_logout_deletes_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)

        # Token must be deleted from DB
        self.assertFalse(Token.objects.filter(key=self.token.key).exists())

        # Calling protected endpoint with the logged out token must now fail
        res = self.client.get("/api/me/")
        self.assertEqual(res.status_code, 401)

    def test_logout_isolated_to_authenticated_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.client.post("/api/logout/")

        # Other user's token must still exist
        self.assertTrue(Token.objects.filter(key=self.other_token.key).exists())

    def test_repeated_logout_safe(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        self.client.post("/api/logout/")
        # Call logout again without active token or re-authenticating
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/logout/")
        self.assertEqual(response.status_code, 200)


# ─────────────────────────────────────────────
# Level 5: Normal User Features & End-to-End Integration Tests
# ─────────────────────────────────────────────

class Level5UserIntegrationTests(APITestCase):

    def setUp(self):
        self.owner_a = make_owner("lvl5_owner_a", "password123")
        self.token_a = Token.objects.create(user=self.owner_a)
        self.wallet_a = Wallet.objects.get(user=self.owner_a)

        self.owner_b = make_owner("lvl5_owner_b", "password123")
        self.token_b = Token.objects.create(user=self.owner_b)
        self.wallet_b = Wallet.objects.get(user=self.owner_b)

        self.admin = make_admin("lvl5_admin", "password123")
        self.admin_token = Token.objects.create(user=self.admin)

        self.plaza_1 = make_plaza("Delhi-Noida Plaza", active=True)
        self.rule_1 = make_rule(self.plaza_1, "CAR", "100.00", active=True)

        self.plaza_2 = make_plaza("Mumbai-Pune Plaza", active=True)
        self.rule_2 = make_rule(self.plaza_2, "CAR", "150.00", active=True)

        self.vehicle_a = make_vehicle(self.owner_a, "DL01AA1111", "RFID-LVL5-A1", "CAR", active=True)
        self.vehicle_b = make_vehicle(self.owner_b, "MH02BB2222", "RFID-LVL5-B1", "CAR", active=True)

    def test_owner_cannot_process_toll_for_another_users_vehicle(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        # Owner A attempts to process Owner B's RFID tag
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_b.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not registered to your account", response.data.get("message", "").lower())

        # Neither wallet should be deducted
        self.wallet_a.refresh_from_db()
        self.wallet_b.refresh_from_db()
        self.assertEqual(self.wallet_a.balance, Decimal("500.00"))
        self.assertEqual(self.wallet_b.balance, Decimal("500.00"))

    def test_owner_cannot_process_toll_for_inactive_vehicle(self):
        self.vehicle_a.is_active = False
        self.vehicle_a.save()

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get("success", True))
        self.assertIn("deactivated", response.data.get("message", "").lower())

        self.wallet_a.refresh_from_db()
        self.assertEqual(self.wallet_a.balance, Decimal("500.00"))

    def test_admin_can_process_toll_for_any_vehicle(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")
        response = self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("success"))

        self.wallet_a.refresh_from_db()
        self.assertEqual(self.wallet_a.balance, Decimal("400.00"))

    def test_owner_wallet_topup_and_isolation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        response = self.client.post(
            "/api/wallet/demo-topup/",
            {"amount": "250.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(response.data["balance"])), Decimal("750.00"))

        # Owner B wallet unchanged
        self.wallet_b.refresh_from_db()
        self.assertEqual(self.wallet_b.balance, Decimal("500.00"))

    def test_owner_wallet_topup_validation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        # Negative amount
        resp_neg = self.client.post("/api/wallet/demo-topup/", {"amount": "-50.00"}, format="json")
        self.assertEqual(resp_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero amount
        resp_zero = self.client.post("/api/wallet/demo-topup/", {"amount": "0.00"}, format="json")
        self.assertEqual(resp_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Excessively large amount
        resp_huge = self.client.post("/api/wallet/demo-topup/", {"amount": "200000.00"}, format="json")
        self.assertEqual(resp_huge.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transactions_list_filtering_by_status(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        # Process 1 successful toll
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )
        # Drain wallet to 0 and trigger an insufficient balance failure
        self.wallet_a.balance = Decimal("0.00")
        self.wallet_a.save()
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )

        # Query all
        res_all = self.client.get("/api/transactions/")
        self.assertEqual(len(res_all.data), 2)

        # Query SUCCESS
        res_succ = self.client.get("/api/transactions/?status=SUCCESS")
        self.assertEqual(len(res_succ.data), 1)
        self.assertEqual(res_succ.data[0]["status"], "SUCCESS")

        # Query FAILED
        res_fail = self.client.get("/api/transactions/?status=FAILED")
        self.assertEqual(len(res_fail.data), 1)
        self.assertEqual(res_fail.data[0]["status"], "FAILED")

    def test_transactions_list_filtering_by_search(self):
        # Create second vehicle for owner A
        veh_a2 = make_vehicle(self.owner_a, "UP16XY9999", "RFID-LVL5-A2", "CAR", active=True)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")

        # Transaction at plaza 1 for DL01AA1111
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )
        # Transaction at plaza 2 for UP16XY9999
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": veh_a2.rfid_tag, "toll_plaza_id": self.plaza_2.id},
            format="json",
        )

        # Search by vehicle reg
        res_reg = self.client.get("/api/transactions/?search=UP16XY")
        self.assertEqual(len(res_reg.data), 1)
        self.assertEqual(res_reg.data[0]["vehicle_registration"], "UP16XY9999")

        # Search by plaza name
        res_plaza = self.client.get("/api/transactions/?search=Delhi-Noida")
        self.assertEqual(len(res_plaza.data), 1)
        self.assertEqual(res_plaza.data[0]["toll_plaza_name"], "Delhi-Noida Plaza")

    def test_transactions_isolation_between_owners(self):
        # Process toll for Owner A
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_a.rfid_tag, "toll_plaza_id": self.plaza_1.id},
            format="json",
        )

        # Process toll for Owner B
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_b.key}")
        self.client.post(
            "/api/toll/process/",
            {"rfid_tag": self.vehicle_b.rfid_tag, "toll_plaza_id": self.plaza_2.id},
            format="json",
        )

        # Owner A must only see 1 transaction (theirs)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_a.key}")
        res_a = self.client.get("/api/transactions/")
        self.assertEqual(len(res_a.data), 1)
        self.assertEqual(res_a.data[0]["vehicle_registration"], self.vehicle_a.registration_number)

        # Owner B must only see 1 transaction (theirs)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token_b.key}")
        res_b = self.client.get("/api/transactions/")
        self.assertEqual(len(res_b.data), 1)
        self.assertEqual(res_b.data[0]["vehicle_registration"], self.vehicle_b.registration_number)


