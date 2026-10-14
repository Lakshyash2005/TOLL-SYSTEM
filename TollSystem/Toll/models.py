from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):

    OWNER = "OWNER"
    STAFF = "STAFF"
    ADMIN = "ADMIN"

    ROLE_CHOICES = [
        (OWNER, "Owner"),
        (STAFF, "Staff"),
        (ADMIN, "Admin"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE
    )

    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default=OWNER
    )

    def __str__(self):
        return f"{self.user.username} - {self.role}"

class Vehicle(models.Model):

    CAR = "CAR"
    BUS = "BUS"
    TRUCK = "TRUCK"
    MOTORCYCLE = "MOTORCYCLE"

    VEHICLE_TYPE_CHOICES = [
        (CAR, "CAR"),
        (BUS, "BUS"),
        (TRUCK, "TRUCK"),
        (MOTORCYCLE, "MOTORCYCLE"),
    ]

    registration_number = models.CharField(
        max_length=20,
        unique=True
    )
    vehicle_type = models.CharField(
        max_length=15,
        choices=VEHICLE_TYPE_CHOICES,
        default=CAR
    )
    rfid_tag = models.CharField(
        max_length=50,
        unique=True
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="vehicles"
    )
    is_active = models.BooleanField(
        default=True
    )
    created_at = models.DateTimeField(
        auto_now_add=True
    )
    updated_at = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return self.registration_number

class TollPlaza(models.Model):

    name = models.CharField(max_length=100)

    location = models.CharField(max_length=200)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class TollRule(models.Model):
    toll_plaza = models.ForeignKey(
        TollPlaza,
        on_delete=models.CASCADE,
        related_name="toll_rules"
    )
    vehicle_type = models.CharField(
        max_length=15,
        choices=Vehicle.VEHICLE_TYPE_CHOICES
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("toll_plaza", "vehicle_type")

    def __str__(self):
        return f"{self.toll_plaza} - {self.vehicle_type} -₹{self.amount}"

class Wallet(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="wallet"
    )

    balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - ₹{self.balance}"


class TollTransaction(models.Model):

    STATUS_CHOICES = [
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
    ]
    STATE_CHOICES = [
       ("DETECTED", "Detected"),
       ("IDENTIFIED", "Identified"),
       ("VERIFIED", "Verified"),
       ("TOLL_CALCULATED", "Toll Calculated"),
       ("PAYMENT_PROCESSING", "Payment Processing"),
       ("PASSED", "Passed"),
       ("UNKNOWN_RFID", "Unknown RFID"),
       ("INVALID_VEHICLE", "Invalid Vehicle"),
       ("INSUFFICIENT_BALANCE", "Insufficient Balance"),
       ("PAYMENT_FAILED", "Payment Failed"),
    ]
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="transactions"
    )

    toll_plaza = models.ForeignKey(
        TollPlaza,
        on_delete=models.CASCADE,
        related_name="transactions"
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES
    )
    state = models.CharField(
        max_length=30,
        choices=STATE_CHOICES,
        default="DETECTED"
    )

    failure_reason = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    transaction_time = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return (
            f"{self.vehicle.registration_number} - "
            f"{self.amount} - {self.status}"
        )
