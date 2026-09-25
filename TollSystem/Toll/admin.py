from django.contrib import admin
from .models import (
    UserProfile,
 Vehicle,
  TollPlaza ,
  TollRule ,
  Wallet,
  TollTransaction, 
)

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email")


admin.site.register(Vehicle)
admin.site.register(TollPlaza)
admin.site.register(TollRule)
admin.site.register(Wallet)
admin.site.register(TollTransaction)