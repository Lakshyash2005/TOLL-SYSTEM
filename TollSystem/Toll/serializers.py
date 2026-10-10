from rest_framework import serializers
from .models import Vehicle
from django.contrib.auth.models import User


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
            "is_active",
            "created_at",
        ]


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
        return User.objects.create_user(
            password=password,
            **validated_data
        )