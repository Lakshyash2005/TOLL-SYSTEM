from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .permission import IsOwner, IsAdmin
from .models import TollPlaza, TollRule, Vehicle, Wallet, TollTransaction, UserProfile
from .serializers import (
    TollProcessSerializer,
    VehicleSerializer,
    WalletSerializer,
    RegisterSerializer,
    TollTransactionSerializer,
    TollPlazaSerializer,
    TollRuleSerializer,
    AdminUserSerializer,
    AdminVehicleSerializer,
    AdminTransactionSerializer,
    UserProfileSerializer,
    PasswordChangeSerializer,
)
from .services import process_toll
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from decimal import Decimal
from django.db import transaction
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Q
import csv
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta


# ─────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────

class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(
            request,
            username=username,
            password=password,
        )
        if user is None:
            return Response(
                {"error": "Invalid username or password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        token, created = Token.objects.get_or_create(user=user)
        try:
            role = user.userprofile.role
        except UserProfile.DoesNotExist:
            role = UserProfile.OWNER
        return Response(
            {
                "token": token.key,
                "username": user.username,
                "role": role,
            },
            status=status.HTTP_200_OK,
        )


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    "message": "Account created successfully",
                    "username": user.username,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )


class MeAPIView(APIView):
    """Return or update current authenticated user profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self.patch(request)


class PasswordChangeAPIView(APIView):
    """Change password for authenticated user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save()
            # Reissue token to keep user authenticated seamlessly
            Token.objects.filter(user=request.user).delete()
            new_token = Token.objects.create(user=request.user)
            return Response(
                {
                    "message": "Password changed successfully.",
                    "token": new_token.key,
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutAPIView(APIView):
    """Securely log out authenticated user and delete token."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            if hasattr(request.user, "auth_token"):
                request.user.auth_token.delete()
            else:
                Token.objects.filter(user=request.user).delete()
        except Exception:
            pass
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)



# ─────────────────────────────────────────────
# OWNER VEHICLE VIEWS
# ─────────────────────────────────────────────

class VehicleListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwner]

    def get(self, request):
        vehicles = Vehicle.objects.filter(owner=request.user).order_by("-created_at")
        serializer = VehicleSerializer(vehicles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = VehicleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VehicleDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwner]

    def _get_vehicle(self, pk, user):
        try:
            return Vehicle.objects.get(pk=pk, owner=user)
        except Vehicle.DoesNotExist:
            return None

    def get(self, request, pk):
        vehicle = self._get_vehicle(pk, request.user)
        if vehicle is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(VehicleSerializer(vehicle).data)

    def put(self, request, pk):
        vehicle = self._get_vehicle(pk, request.user)
        if vehicle is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = VehicleSerializer(vehicle, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)


# ─────────────────────────────────────────────
# TOLL VIEWS
# ─────────────────────────────────────────────

class TollPlazaListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plazas = TollPlaza.objects.filter(is_active=True).order_by("name")
        serializer = TollPlazaSerializer(plazas, many=True)
        return Response(serializer.data)


class TollProcessAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TollProcessSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        rfid_tag = serializer.validated_data["rfid_tag"]
        toll_plaza_id = serializer.validated_data["toll_plaza_id"]

        # Check vehicle ownership if caller is OWNER without admin/staff role
        try:
            role = request.user.userprofile.role
        except Exception:
            role = UserProfile.OWNER

        is_admin_or_staff = request.user.is_superuser or request.user.is_staff or role in [UserProfile.ADMIN, UserProfile.STAFF]

        if not is_admin_or_staff and role == UserProfile.OWNER:
            vehicle = Vehicle.objects.filter(rfid_tag=rfid_tag, owner=request.user).first()
            if not vehicle:
                return Response(
                    {"success": False, "state": "UNKNOWN_RFID", "message": "Vehicle not found or not registered to your account"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not vehicle.is_active:
                return Response(
                    {"success": False, "state": "UNKNOWN_RFID", "message": "Vehicle is deactivated. Please activate it first."},
                    status=status.HTTP_400_BAD_REQUEST
                )

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


# ─────────────────────────────────────────────
# WALLET VIEWS
# ─────────────────────────────────────────────

class WalletAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, created = Wallet.objects.get_or_create(user=request.user)
        serializer = WalletSerializer(wallet)
        return Response(serializer.data)


class DemoWalletTopUpAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        from .serializers import DemoTopUpSerializer
        serializer = DemoTopUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

        amount = serializer.validated_data["amount"]
        wallet.balance += amount
        wallet.save(update_fields=["balance", "updated_at"])

        return Response({
            "message": "Demo top-up successful",
            "demo_mode": True,
            "amount_added": str(amount),
            "balance": str(wallet.balance),
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# TRANSACTION VIEWS
# ─────────────────────────────────────────────

class TollTransactionListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = (
            TollTransaction.objects.filter(vehicle__owner=request.user)
            .select_related("vehicle", "toll_plaza")
            .order_by("-transaction_time")
        )

        status_param = request.query_params.get("status")
        if status_param and status_param.upper() in ["SUCCESS", "FAILED"]:
            queryset = queryset.filter(status=status_param.upper())

        search_param = request.query_params.get("search")
        if search_param:
            search_param = search_param.strip()
            queryset = queryset.filter(
                Q(vehicle__registration_number__icontains=search_param) |
                Q(toll_plaza__name__icontains=search_param)
            )

        serializer = TollTransactionSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
# ADMIN DASHBOARD
# ─────────────────────────────────────────────

class AdminDashboardStatsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        # Date range validation: 7d (default) or 30d
        range_param = request.query_params.get("range", "7d").lower().strip()
        days = 30 if range_param == "30d" else 7

        now = timezone.now()
        start_date = now - timedelta(days=days)

        total_users = User.objects.count()
        total_vehicles = Vehicle.objects.count()
        active_vehicles = Vehicle.objects.filter(is_active=True).count()
        active_plazas = TollPlaza.objects.filter(is_active=True).count()
        inactive_plazas = TollPlaza.objects.filter(is_active=False).count()

        success_txns = TollTransaction.objects.filter(status="SUCCESS")
        failed_txns = TollTransaction.objects.filter(status="FAILED")

        total_revenue = success_txns.aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")

        # Range-specific transactions
        range_txns = TollTransaction.objects.filter(transaction_time__gte=start_date)
        range_success = range_txns.filter(status="SUCCESS")
        range_failed = range_txns.filter(status="FAILED")
        range_revenue = range_success.aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")

        # Daily chart buckets
        day_buckets = {}
        for d in range(days - 1, -1, -1):
            day_date = (now - timedelta(days=d)).date()
            day_str = day_date.strftime("%Y-%m-%d")
            day_buckets[day_str] = {
                "date": day_str,
                "label": day_date.strftime("%b %d"),
                "success": 0,
                "failed": 0,
                "revenue": Decimal("0.00"),
            }

        for txn in range_txns.values("transaction_time", "status", "amount"):
            txn_date_str = txn["transaction_time"].date().strftime("%Y-%m-%d")
            if txn_date_str in day_buckets:
                if txn["status"] == "SUCCESS":
                    day_buckets[txn_date_str]["success"] += 1
                    day_buckets[txn_date_str]["revenue"] += txn["amount"]
                elif txn["status"] == "FAILED":
                    day_buckets[txn_date_str]["failed"] += 1

        chart_data = [
            {
                "date": v["date"],
                "label": v["label"],
                "success": v["success"],
                "failed": v["failed"],
                "revenue": str(v["revenue"]),
            }
            for v in day_buckets.values()
        ]

        # Toll plaza activity in range
        plazas = TollPlaza.objects.all().order_by("name")
        plaza_txns_stats = range_txns.values("toll_plaza_id").annotate(
            total_count=Count("id"),
            revenue=Sum("amount", filter=Q(status="SUCCESS"))
        )
        stats_map = {item["toll_plaza_id"]: item for item in plaza_txns_stats}
        plaza_activity = []
        for p in plazas:
            st = stats_map.get(p.id, {})
            plaza_activity.append({
                "id": p.id,
                "name": p.name,
                "location": p.location,
                "is_active": p.is_active,
                "transaction_count": st.get("total_count", 0),
                "successful_revenue": str(st.get("revenue") or Decimal("0.00")),
            })

        recent_transactions = (
            TollTransaction.objects
            .select_related("vehicle", "toll_plaza")
            .order_by("-transaction_time")[:10]
        )

        return Response({
            "total_users": total_users,
            "total_vehicles": total_vehicles,
            "active_vehicles": active_vehicles,
            "active_plazas": active_plazas,
            "inactive_plazas": inactive_plazas,
            "total_plazas": active_plazas + inactive_plazas,
            "successful_transactions": success_txns.count(),
            "failed_transactions": failed_txns.count(),
            "total_transactions": TollTransaction.objects.count(),
            "total_revenue": str(total_revenue),
            "range": "30d" if days == 30 else "7d",
            "range_days": days,
            "range_total": range_txns.count(),
            "range_successful": range_success.count(),
            "range_failed": range_failed.count(),
            "range_revenue": str(range_revenue),
            "chart_data": chart_data,
            "plaza_activity": plaza_activity,
            "recent_transactions": AdminTransactionSerializer(
                recent_transactions, many=True
            ).data,
        })


# ─────────────────────────────────────────────
# ADMIN USER MANAGEMENT
# ─────────────────────────────────────────────

class AdminUserListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        users = User.objects.select_related("userprofile").order_by("-date_joined")
        if search:
            users = users.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        serializer = AdminUserSerializer(users, many=True)
        return Response(serializer.data)


class AdminUserDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Protect superusers from being deactivated via API
        if user.is_superuser:
            return Response(
                {"detail": "Superuser accounts cannot be modified via API."},
                status=status.HTTP_403_FORBIDDEN
            )

        allowed = ("is_active",)
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()

        return Response(AdminUserSerializer(user).data)


# ─────────────────────────────────────────────
# ADMIN VEHICLE MANAGEMENT
# ─────────────────────────────────────────────

class AdminVehicleListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        vehicles = Vehicle.objects.select_related("owner").order_by("-created_at")
        if search:
            vehicles = vehicles.filter(
                Q(registration_number__icontains=search) |
                Q(rfid_tag__icontains=search) |
                Q(owner__username__icontains=search)
            )
        serializer = AdminVehicleSerializer(vehicles, many=True)
        return Response(serializer.data)


class AdminVehicleDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        try:
            vehicle = Vehicle.objects.get(pk=pk)
        except Vehicle.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if "is_active" in request.data:
            vehicle.is_active = bool(request.data["is_active"])
            vehicle.save(update_fields=["is_active", "updated_at"])

        return Response(AdminVehicleSerializer(vehicle).data)


# ─────────────────────────────────────────────
# ADMIN TOLL PLAZA MANAGEMENT
# ─────────────────────────────────────────────

class AdminTollPlazaListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        plazas = TollPlaza.objects.order_by("name")
        if search:
            plazas = plazas.filter(
                Q(name__icontains=search) | Q(location__icontains=search)
            )
        serializer = TollPlazaSerializer(plazas, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TollPlazaSerializer(data=request.data)
        if serializer.is_valid():
            plaza = serializer.save()
            return Response(TollPlazaSerializer(plaza).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminTollPlazaDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        try:
            plaza = TollPlaza.objects.get(pk=pk)
        except TollPlaza.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(TollPlazaSerializer(plaza).data)

    def put(self, request, pk):
        try:
            plaza = TollPlaza.objects.get(pk=pk)
        except TollPlaza.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = TollPlazaSerializer(plaza, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)


# ─────────────────────────────────────────────
# ADMIN TOLL RULE MANAGEMENT
# ─────────────────────────────────────────────

class AdminTollRuleListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        plaza_id = request.query_params.get("plaza_id")
        rules = TollRule.objects.select_related("toll_plaza").order_by("toll_plaza__name", "vehicle_type")
        if plaza_id:
            rules = rules.filter(toll_plaza_id=plaza_id)
        serializer = TollRuleSerializer(rules, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TollRuleSerializer(data=request.data)
        if serializer.is_valid():
            rule = serializer.save()
            return Response(TollRuleSerializer(rule).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminTollRuleDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, pk):
        try:
            rule = TollRule.objects.get(pk=pk)
        except TollRule.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = TollRuleSerializer(rule, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        try:
            rule = TollRule.objects.get(pk=pk)
        except TollRule.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────
# ADMIN TRANSACTION MONITORING
# ─────────────────────────────────────────────

class AdminTransactionListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (
            TollTransaction.objects
            .select_related("vehicle", "vehicle__owner", "toll_plaza")
            .order_by("-transaction_time")
        )

        # Filters
        txn_status = request.query_params.get("status")
        plaza_id = request.query_params.get("plaza_id")
        search = request.query_params.get("search", "").strip()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if txn_status:
            qs = qs.filter(status=txn_status.upper())
        if plaza_id:
            qs = qs.filter(toll_plaza_id=plaza_id)
        if search:
            qs = qs.filter(
                Q(vehicle__registration_number__icontains=search) |
                Q(toll_plaza__name__icontains=search)
            )
        if date_from:
            qs = qs.filter(transaction_time__date__gte=date_from)
        if date_to:
            qs = qs.filter(transaction_time__date__lte=date_to)

        # Aggregate summary
        success_revenue = qs.filter(status="SUCCESS").aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")

        serializer = AdminTransactionSerializer(qs[:200], many=True)
        return Response({
            "count": qs.count(),
            "successful_revenue": str(success_revenue),
            "results": serializer.data,
        })


# ─────────────────────────────────────────────
# ADMIN REPORTS & CSV EXPORT
# ─────────────────────────────────────────────

class AdminReportsAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        success_txns = TollTransaction.objects.filter(status="SUCCESS")
        failed_txns = TollTransaction.objects.filter(status="FAILED")
        total_txns = TollTransaction.objects.count()

        total_revenue = success_txns.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        success_count = success_txns.count()
        failed_count = failed_txns.count()

        success_rate = (
            round((success_count / total_txns) * 100, 1)
            if total_txns > 0
            else 0.0
        )

        # Breakdown by Toll Plaza
        plazas = TollPlaza.objects.all().order_by("name")
        plaza_reports = []
        for p in plazas:
            p_txns = TollTransaction.objects.filter(toll_plaza=p)
            p_success = p_txns.filter(status="SUCCESS")
            p_rev = p_success.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            plaza_reports.append({
                "id": p.id,
                "name": p.name,
                "location": p.location,
                "is_active": p.is_active,
                "total_transactions": p_txns.count(),
                "successful_transactions": p_success.count(),
                "failed_transactions": p_txns.filter(status="FAILED").count(),
                "revenue": str(p_rev),
            })

        # Breakdown by Vehicle Type
        vehicle_type_reports = []
        for v_type, _ in Vehicle.VEHICLE_TYPE_CHOICES:
            v_txns = TollTransaction.objects.filter(vehicle__vehicle_type=v_type)
            v_success = v_txns.filter(status="SUCCESS")
            v_rev = v_success.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            vehicle_type_reports.append({
                "vehicle_type": v_type,
                "total_transactions": v_txns.count(),
                "successful_transactions": v_success.count(),
                "failed_transactions": v_txns.filter(status="FAILED").count(),
                "revenue": str(v_rev),
            })

        # 7-day trend
        today = timezone.now().date()
        daily_trend = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_txns = TollTransaction.objects.filter(transaction_time__date=day)
            day_success = day_txns.filter(status="SUCCESS")
            day_rev = day_success.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            daily_trend.append({
                "date": day.strftime("%Y-%m-%d"),
                "total_transactions": day_txns.count(),
                "successful_transactions": day_success.count(),
                "revenue": str(day_rev),
            })

        return Response({
            "total_revenue": str(total_revenue),
            "total_transactions": total_txns,
            "successful_transactions": success_count,
            "failed_transactions": failed_count,
            "success_rate_percent": success_rate,
            "by_plaza": plaza_reports,
            "by_vehicle_type": vehicle_type_reports,
            "daily_trend": daily_trend,
        })


class AdminTransactionExportCSVAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = (
            TollTransaction.objects
            .select_related("vehicle", "vehicle__owner", "toll_plaza")
            .order_by("-transaction_time")
        )

        txn_status = request.query_params.get("status")
        plaza_id = request.query_params.get("plaza_id")
        search = request.query_params.get("search", "").strip()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if txn_status:
            qs = qs.filter(status=txn_status.upper())
        if plaza_id:
            qs = qs.filter(toll_plaza_id=plaza_id)
        if search:
            qs = qs.filter(
                Q(vehicle__registration_number__icontains=search) |
                Q(toll_plaza__name__icontains=search)
            )
        if date_from:
            qs = qs.filter(transaction_time__date__gte=date_from)
        if date_to:
            qs = qs.filter(transaction_time__date__lte=date_to)

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="tollflow_transactions.csv"'

        writer = csv.writer(response)
        writer.writerow([
            "Transaction ID",
            "Date Time",
            "Vehicle Registration",
            "Vehicle Type",
            "Owner Username",
            "Toll Plaza",
            "Amount (INR)",
            "Status",
            "FSM State",
            "Failure Reason",
        ])

        for t in qs:
            writer.writerow([
                t.id,
                t.transaction_time.strftime("%Y-%m-%d %H:%M:%S") if t.transaction_time else "",
                t.vehicle.registration_number if t.vehicle else "",
                t.vehicle.vehicle_type if t.vehicle else "",
                t.vehicle.owner.username if t.vehicle and t.vehicle.owner else "",
                t.toll_plaza.name if t.toll_plaza else "",
                str(t.amount),
                t.status,
                t.state,
                t.failure_reason or "",
            ])

        return response
