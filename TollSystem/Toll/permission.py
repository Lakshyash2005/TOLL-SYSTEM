from rest_framework.permissions import BasePermission
from .models import UserProfile

class IsOwner(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        try:
            return request.user.userprofile.role == UserProfile.OWNER
        except UserProfile.DoesNotExist:
            return True

class IsStaff(BasePermission):
    def has_permission(self , request  , view):
        if not request.user.is_authenticated:
            return False
        try:
            return request.user.userprofile.role == UserProfile.STAFF
        except UserProfile.DoesNotExist:
            return False

class IsAdmin(BasePermission):
    def has_permission(self , request , view):
        if not request.user.is_authenticated:
            return False 

        if request.user.is_superuser or request.user.is_staff:
            return True

        try:
            return request.user.userprofile.role in [UserProfile.ADMIN, UserProfile.STAFF]
        except UserProfile.DoesNotExist:
            return False