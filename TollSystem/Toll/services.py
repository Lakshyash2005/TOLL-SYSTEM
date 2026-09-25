from .models import TollRule, Vehicle, TollTransaction, Wallet
from decimal import Decimal
from django.db import transaction

from .models import (
    TollRule,
    Vehicle,
    TollTransaction,
)

def calculate_toll(vehicle, toll_plaza):
    try:
        rule = TollRule.objects.get(
            toll_plaza=toll_plaza,
            vehicle_type=vehicle.vehicle_type,
            is_active=True
        )
        return rule.amount

    except TollRule.DoesNotExist:
        return None


def process_toll(rfid_tag, toll_plaza):
    try:
        vehicle = Vehicle.objects.get(
            rfid_tag=rfid_tag,
            is_active=True
        )
    except Vehicle.DoesNotExist:
        return {
            "success": False,
            "message": "Vehicle not found or inactive"
        }

    amount = calculate_toll(vehicle, toll_plaza)

    if amount is None:
        return {
            "success": False,
            "message": "No toll rule found"
        }

    wallet = vehicle.owner.wallet

    if wallet.balance < amount:
        transaction_record = TollTransaction.objects.create(
            vehicle=vehicle,
            toll_plaza=toll_plaza,
            amount=amount,
            status="FAILED",
            failure_reason="Insufficient wallet balance"
        )

        return {
            "success": False,
            "message": "Insufficient wallet balance",
            "transaction": transaction_record
        }

    with transaction.atomic():

        wallet.balance -= amount
        wallet.save()

        transaction_record = TollTransaction.objects.create(
            vehicle=vehicle,
            toll_plaza=toll_plaza,
            amount=amount,
            status="SUCCESS"
        )

    return {
        "success": True,
        "message": "Toll payment successful",
        "amount": amount,
        "transaction": transaction_record
    }