from rest_framework import serializers
from .models import Vehicle, Wallet, UserProfile, TollTransaction, TollPlaza, TollRule
from django.contrib.auth.models import User
from decimal import Decimal
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import re


class UserProfileSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "date_joined",
            "last_login",
        ]
        read_only_fields = [
            "id",
            "username",
            "role",
            "is_active",
            "date_joined",
            "last_login",
        ]

    def get_role(self, obj):
        try:
            return obj.userprofile.role
        except Exception:
            return UserProfile.OWNER

    def validate_email(self, value):
        val = value.strip().lower()
        if not val:
            raise serializers.ValidationError("Email address cannot be empty.")
        user = self.instance
        if User.objects.filter(email__iexact=val).exclude(pk=user.pk if user else None).exists():
            raise serializers.ValidationError("This email address is already in use by another account.")
        return val

    def update(self, instance, validated_data):
        instance.email = validated_data.get("email", instance.email)
        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)
        instance.save()
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is not correct.")
        return value

    def validate(self, attrs):
        if attrs.get("new_password") != attrs.get("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})

        user = self.context["request"].user
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})

        if attrs.get("new_password") == attrs.get("current_password"):
            raise serializers.ValidationError({"new_password": "New password cannot be the same as current password."})

        return attrs



class VehicleSerializer(serializers.ModelSerializer):

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "registration_number",
            "rfid_tag",
            "vehicle_type",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
        ]
        extra_kwargs = {
            "registration_number": {
                "error_messages": {
                    "unique": "A vehicle with this registration number is already registered.",
                    "blank": "Registration number cannot be blank.",
                }
            },
            "rfid_tag": {
                "error_messages": {
                    "unique": "A vehicle with this RFID tag is already registered.",
                    "blank": "RFID tag cannot be blank.",
                }
            },
        }

    def validate_registration_number(self, value):
        val = value.strip().upper()
        if len(val) < 4:
            raise serializers.ValidationError("Registration number must be at least 4 characters.")
        if len(val) > 20:
            raise serializers.ValidationError("Registration number cannot exceed 20 characters.")
        if not re.match(r"^[A-Z0-9\- ]+$", val):
            raise serializers.ValidationError("Registration number can only contain letters, numbers, spaces, and hyphens.")
        return val

    def validate_rfid_tag(self, value):
        val = value.strip()
        if len(val) < 3:
            raise serializers.ValidationError("RFID tag must be at least 3 characters.")
        if len(val) > 50:
            raise serializers.ValidationError("RFID tag cannot exceed 50 characters.")
        return val


class TollProcessSerializer(serializers.Serializer):
    rfid_tag = serializers.CharField(max_length=100)
    toll_plaza_id = serializers.IntegerField(min_value=1)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    class Meta:
        model = User
        fields = ["username", "password", "email"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        UserProfile.objects.create(user=user, role=UserProfile.OWNER)
        Wallet.objects.create(user=user)
        return user

class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ["balance", "updated_at"]
        read_only_fields = ["balance", "updated_at"]


class TollTransactionSerializer(serializers.ModelSerializer):
    vehicle_registration = serializers.CharField(source="vehicle.registration_number", read_only=True)
    toll_plaza_name = serializers.CharField(source="toll_plaza.name", read_only=True)
    created_at = serializers.DateTimeField(source="transaction_time", read_only=True)

    class Meta:
        model = TollTransaction
        fields = [
            "id",
            "vehicle",
            "vehicle_registration",
            "toll_plaza",
            "toll_plaza_name",
            "amount",
            "status",
            "state",
            "failure_reason",
            "transaction_time",
            "created_at",
        ]
        read_only_fields = fields


class DemoTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("1.00"),
        max_value=Decimal("100000.00"),
    )


class TollPlazaSerializer(serializers.ModelSerializer):
    class Meta:
        model = TollPlaza
        fields = ["id", "name", "location", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name cannot be blank.")
        return value.strip()

    def validate_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Location cannot be blank.")
        return value.strip()


class TollRuleSerializer(serializers.ModelSerializer):
    toll_plaza_name = serializers.CharField(source="toll_plaza.name", read_only=True)

    class Meta:
        model = TollRule
        fields = [
            "id",
            "toll_plaza",
            "toll_plaza_name",
            "vehicle_type",
            "amount",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "toll_plaza_name"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class AdminUserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    vehicle_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_active",
            "date_joined",
            "last_login",
            "role",
            "vehicle_count",
        ]

    def get_role(self, obj):
        try:
            return obj.userprofile.role
        except UserProfile.DoesNotExist:
            return None

    def get_vehicle_count(self, obj):
        return obj.vehicles.count()


class AdminVehicleSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    owner_wallet_balance = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "registration_number",
            "rfid_tag",
            "vehicle_type",
            "is_active",
            "owner",
            "owner_username",
            "owner_wallet_balance",
            "created_at",
        ]
        read_only_fields = fields

    def get_owner_wallet_balance(self, obj):
        try:
            return str(obj.owner.wallet.balance)
        except Exception:
            return "0.00"


class AdminTransactionSerializer(serializers.ModelSerializer):
    vehicle_registration = serializers.CharField(source="vehicle.registration_number", read_only=True)
    toll_plaza_name = serializers.CharField(source="toll_plaza.name", read_only=True)
    owner_username = serializers.CharField(source="vehicle.owner.username", read_only=True)

    class Meta:
        model = TollTransaction
        fields = [
            "id",
            "vehicle_registration",
            "owner_username",
            "toll_plaza_name",
            "amount",
            "status",
            "state",
            "failure_reason",
            "transaction_time",
        ]
        read_only_fields = fields