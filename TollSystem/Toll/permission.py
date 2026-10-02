from rest_framework.permissions import BasePermission
from .models import UserProfile

class IsOwner(BasePermission):
    def has_permission(self , request , view):
        if not request.user.is_authenticated:
            return False

        try:
            return request.user.userprofile.role == UserProfile.OWNER
        except UserProfile.DoesNotExist:
            return False 

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

        try:
            return request.user.userprofile.role == UserProfile.ADMIN
        except UserProfile.DoesNotExist:
            return False   