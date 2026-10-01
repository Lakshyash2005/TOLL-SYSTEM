from django.urls import path 
from .views import VehicleListAPIView , TollProcessAPIView

urlpatterns = [ 
    path(
        "vehicles/",
        VehicleListAPIView.as_view(),
        name = "vehicle-list",
    ),
     path(
        "toll/process/",
        TollProcessAPIView.as_view(),
        name="toll-process",
    ),
]