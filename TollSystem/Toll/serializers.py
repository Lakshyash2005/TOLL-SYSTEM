from rest_framework import serializers
from .models import Vehicle


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
    rfid_tag = serializers.CharField(max_length = 100)
    toll_plaza_id = serializers.IntegerField(min_value = 1 )