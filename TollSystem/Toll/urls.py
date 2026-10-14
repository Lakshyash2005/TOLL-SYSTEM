from django.urls import path
from .views import (
    # Auth
    LoginAPIView,
    RegisterAPIView,
    MeAPIView,
    LogoutAPIView,
    PasswordChangeAPIView,
    # Owner
    VehicleListAPIView,
    VehicleDetailAPIView,
    TollProcessAPIView,
    WalletAPIView,
    DemoWalletTopUpAPIView,
    TollTransactionListAPIView,
    TollPlazaListAPIView,
    # Admin
    AdminDashboardStatsAPIView,
    AdminUserListAPIView,
    AdminUserDetailAPIView,
    AdminVehicleListAPIView,
    AdminVehicleDetailAPIView,
    AdminTollPlazaListAPIView,
    AdminTollPlazaDetailAPIView,
    AdminTollRuleListAPIView,
    AdminTollRuleDetailAPIView,
    AdminTransactionListAPIView,
    AdminReportsAPIView,
    AdminTransactionExportCSVAPIView,
)

urlpatterns = [
    # ── Auth ──────────────────────────────────
    path("login/", LoginAPIView.as_view(), name="login"),
    path("register/", RegisterAPIView.as_view(), name="register"),
    path("logout/", LogoutAPIView.as_view(), name="logout"),
    path("me/", MeAPIView.as_view(), name="me"),
    path("password/change/", PasswordChangeAPIView.as_view(), name="password-change"),

    # ── Owner ─────────────────────────────────
    path("vehicles/", VehicleListAPIView.as_view(), name="vehicle-list"),
    path("vehicles/<int:pk>/", VehicleDetailAPIView.as_view(), name="vehicle-detail"),
    path("wallet/", WalletAPIView.as_view(), name="wallet"),
    path("wallet/demo-topup/", DemoWalletTopUpAPIView.as_view(), name="wallet-demo-topup"),
    path("transactions/", TollTransactionListAPIView.as_view(), name="transaction-list"),
    path("toll/process/", TollProcessAPIView.as_view(), name="toll-process"),
    path("toll/plazas/", TollPlazaListAPIView.as_view(), name="toll-plaza-list"),

    # ── Admin ─────────────────────────────────
    path("admin/stats/", AdminDashboardStatsAPIView.as_view(), name="admin-stats"),
    path("admin/users/", AdminUserListAPIView.as_view(), name="admin-user-list"),
    path("admin/users/<int:pk>/", AdminUserDetailAPIView.as_view(), name="admin-user-detail"),
    path("admin/vehicles/", AdminVehicleListAPIView.as_view(), name="admin-vehicle-list"),
    path("admin/vehicles/<int:pk>/", AdminVehicleDetailAPIView.as_view(), name="admin-vehicle-detail"),
    path("admin/plazas/", AdminTollPlazaListAPIView.as_view(), name="admin-plaza-list"),
    path("admin/plazas/<int:pk>/", AdminTollPlazaDetailAPIView.as_view(), name="admin-plaza-detail"),
    path("admin/rules/", AdminTollRuleListAPIView.as_view(), name="admin-rule-list"),
    path("admin/rules/<int:pk>/", AdminTollRuleDetailAPIView.as_view(), name="admin-rule-detail"),
    path("admin/transactions/", AdminTransactionListAPIView.as_view(), name="admin-transaction-list"),
    path("admin/transactions/export/", AdminTransactionExportCSVAPIView.as_view(), name="admin-transaction-export"),
    path("admin/reports/", AdminReportsAPIView.as_view(), name="admin-reports"),
]