from django.urls import path
from .views import VehicleListAPIView, TollProcessAPIView, LoginAPIView, RegisterAPIView

urlpatterns = [
    path(
        "login/",
        LoginAPIView.as_view(),
        name="login",
    ),
    path(
        "vehicles/",
        VehicleListAPIView.as_view(),
        name="vehicle-list",
    ),
    path(
        "toll/process/",
        TollProcessAPIView.as_view(),
        name="toll-process",
    ),
    path(
        "register/" , RegisterAPIView.as_view() ,name="register"
    )
]