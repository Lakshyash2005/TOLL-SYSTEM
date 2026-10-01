from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import TollPlaza
from .serializers import TollProcessSerializer
from .services import process_toll
from .models import Vehicle
from .serializers import VehicleSerializer


class VehicleListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicles = Vehicle.objects.filter(owner=request.user)

        serializer = VehicleSerializer(
            vehicles,
            many=True
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def post(self, request):
        serializer = VehicleSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(owner=request.user)

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
class TollProcessAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self , request):
        serializer = TollProcessSerializer(data = request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        rfid_tag = serializer.validated_data["rfid_tag"]
        toll_plaza_id = serializer.validated_data["toll_plaza_id"]
        try:
            toll_plaza = TollPlaza.objects.get(
                id=toll_plaza_id,
                is_active=True
            )
        except TollPlaza.DoesNotExist:
            return Response(
                {"message": "Toll plaza not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )
        result = process_toll(rfid_tag, toll_plaza)
        transaction_record = result.get("transaction")

        response_data = {
            "success": result["success"],
            "state": result["state"],
            "message": result["message"],
        }
        if "amount" in result:
            response_data["amount"] = str(result["amount"])
        if transaction_record is not None:
            response_data["transaction_id"] = transaction_record.id
        if result["success"]:
            response_status = status.HTTP_200_OK
        else:
            response_status = status.HTTP_400_BAD_REQUEST
        return Response(response_data, status=response_status)