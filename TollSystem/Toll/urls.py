from django.urls import path 
from .views import VehicleListAPIView

urlpatterns = [ 
    path(
        "vehicles/",
        VehicleListAPIView.as_view(),
        name = "vehicle-list",
    ),
]