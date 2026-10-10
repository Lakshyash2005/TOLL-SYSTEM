from decimal import Decimal
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
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


class TollProcessingTests(TestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            username="testowner",
            password="testpassword"
        )
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)

        self.vehicle = Vehicle.objects.create(
            registration_number="TEST1234",
            rfid_tag="TEST-RFID-001",
            vehicle_type="CAR",
            owner=self.user,
            is_active=True
        )

        self.plaza = TollPlaza.objects.create(
            name="Test Toll Plaza",
            location="Test Location",
            is_active=True
        )

        TollRule.objects.create(
            toll_plaza=self.plaza,
            vehicle_type="CAR",
            amount=Decimal("80.00"),
            is_active=True
        )

        self.wallet = Wallet.objects.create(
            user=self.user,
            balance=Decimal("500.00")
        )

    def test_successful_toll(self):

        result = process_toll(
            self.vehicle.rfid_tag,
            self.plaza
        )

        self.assertTrue(result["success"])

        self.assertEqual(
            result["state"],
            "PASSED"
        )

        self.assertEqual(
            result["amount"],
            Decimal("80.00")
        )

        self.wallet.refresh_from_db()

        self.assertEqual(
            self.wallet.balance,
            Decimal("420.00")
        )

        transaction = TollTransaction.objects.get(
            vehicle=self.vehicle
        )

        self.assertEqual(
            transaction.status,
            "SUCCESS"
        )

        self.assertEqual(
            transaction.state,
            "PASSED"
        )

    def test_unknown_rfid(self):

        result = process_toll(
            "DOES-NOT-EXIST",
            self.plaza
        )

        self.assertFalse(result["success"])

        self.assertEqual(
            result["state"],
            "UNKNOWN_RFID"
        )

    def test_insufficient_balance(self):

        self.wallet.balance = Decimal("10.00")
        self.wallet.save()

        result = process_toll(
            self.vehicle.rfid_tag,
            self.plaza
        )

        self.assertFalse(result["success"])

        self.assertEqual(
            result["state"],
            "INSUFFICIENT_BALANCE"
        )

        self.wallet.refresh_from_db()

        self.assertEqual(
            self.wallet.balance,
            Decimal("10.00")
        )

        transaction = TollTransaction.objects.get(
            vehicle=self.vehicle
        )

        self.assertEqual(
            transaction.status,
            "FAILED"
        )
class VehicleListAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            username="api_test_owner",
            password="testpassword"
        )

        UserProfile.objects.create(
            user = self.user,
            role = UserProfile.OWNER
        )

        self.vehicle = Vehicle.objects.create(
            registration_number="API1234",
            rfid_tag="API-RFID-001",
            vehicle_type="CAR",
            owner=self.user,
            is_active=True
        )

    def test_vehicle_list_returns_vehicles(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        self.assertEqual(
            response.data[0]["registration_number"],
            "API1234"
        )
    def test_create_vehicle(self):
        self.client.force_authenticate(user=self.user)

        data = {
            "registration_number": "NEW1234",
            "rfid_tag":"NEW-RFID-001",
            "vehicle_type":"CAR",
        }
        response = self.client.post(
            "/api/vehicles/",
            data,
            format = "json"
        )
        print(response.data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["registration_number"],
            "NEW1234"
        )
        vehicle = Vehicle.objects.get(
            registration_number = "NEW1234"
        )
        self.assertEqual(vehicle.owner, self.user)
    
    

    def test_unauthenticated_user_cannot_list_vehicles(self):
        response = self.client.get("/api/vehicles/")
        self.assertIn(response.status_code,[401,403])
    def test_create_vehicle_with_invalid_data(self):
        self.client.force_authenticate(user=self.user)

        data = {
            "registration_number": "INVALID123",
            "rfid_tag": "INVALID-RFID",
            "vehicle_type": "PLANE",
        }

        response = self.client.post(
            "/api/vehicles/",
            data=data,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
    def test_staff_cannot_access_owner_vehicle_api(self):
        staff = User.objects.create_user(
            username="api_test_staff",
            password="testpass123"
        )

        UserProfile.objects.create(
            user=staff,
            role=UserProfile.STAFF
        )

        self.client.force_authenticate(user=staff)

        response = self.client.get("/api/vehicles/")

        self.assertIn(response.status_code, [401, 403])

    def test_admin_cannot_access_owner_vehicle_api(self):
        admin = User.objects.create_user(
            username="api_test_admin",
            password="testpass123"
        )

        UserProfile.objects.create(
            user=admin,
            role=UserProfile.ADMIN
        )

        self.client.force_authenticate(user=admin)

        response = self.client.get("/api/vehicles/")

        self.assertIn(response.status_code, [401, 403])
    def test_owner_can_only_see_own_vehicles(self):
        other_user = User.objects.create_user(
            username="another_owner",
            password="testpass123"
        )

        UserProfile.objects.create(
            user=other_user,
            role=UserProfile.OWNER
        )

        Vehicle.objects.create(
            registration_number="OTHER123",
            rfid_tag="OTHER-RFID-001",
            vehicle_type="CAR",
            owner=other_user,
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, 200)

        registrations = [
            vehicle["registration_number"]
            for vehicle in response.data
        ]

        self.assertIn("API1234", registrations)
        self.assertNotIn("OTHER123", registrations)
class TollProcessAPITests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="toll_api_owner",
            password="testpassword"
        )
        UserProfile.objects.create(user=self.user, role=UserProfile.OWNER)

        self.vehicle = Vehicle.objects.create(
            registration_number="TOLL1234",
            rfid_tag="TOLL-RFID-001",
            vehicle_type="CAR",
            owner=self.user,
            is_active=True
        )

        self.plaza = TollPlaza.objects.create(
            name="API Test Toll Plaza",
            location="API Test Location",
            is_active=True
        )

        TollRule.objects.create(
            toll_plaza=self.plaza,
            vehicle_type="CAR",
            amount=Decimal("80.00"),
            is_active=True
        )

        self.wallet = Wallet.objects.create(
            user=self.user,
            balance=Decimal("500.00")
        )

        self.client.force_authenticate(user=self.user)

    def test_successful_toll_payment(self):
        response = self.client.post(
            "/api/toll/process/",
            {
                "rfid_tag": self.vehicle.rfid_tag,
                "toll_plaza_id": self.plaza.id,
            },
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
            {
                "rfid_tag": "UNKNOWN-RFID-999",
                "toll_plaza_id": self.plaza.id,
            },
            format="json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["state"], "UNKNOWN_RFID")

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))
    def test_insufficient_balance_does_not_deduct_wallet(self):
        self.wallet.balance = Decimal("20.00")
        self.wallet.save()
        response = self.client.post(
            "/api/toll/process/",
            {
                "rfid_tag": self.vehicle.rfid_tag,
                "toll_plaza_id": self.plaza.id,
            },
            format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertEqual(
            response.data["state"],
            "INSUFFICIENT_BALANCE"
        )

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("20.00"))
        transaction_record = TollTransaction.objects.get(
            vehicle=self.vehicle,
            toll_plaza=self.plaza
        )

        self.assertEqual(transaction_record.status, "FAILED")
        self.assertEqual(
            transaction_record.state,
            "INSUFFICIENT_BALANCE"
        )

    def test_unauthenticated_user_cannot_process_toll(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/toll/process/",
            {
                "rfid_tag": self.vehicle.rfid_tag,
                "toll_plaza_id": self.plaza.id,
            },
            format="json"
        )

        self.assertIn(response.status_code, [401, 403])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("500.00"))
        self.assertEqual(TollTransaction.objects.count(), 0)
    def test_inactive_or_missing_toll_plaza(self):
        response = self.client.post(
            "/api/toll/process/",
            {
                "rfid_tag": self.vehicle.rfid_tag,
                "toll_plaza_id": 99999,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND
        )

        self.wallet.refresh_from_db()

        self.assertEqual(
            self.wallet.balance,
            Decimal("500.00")
        )
