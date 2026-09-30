from decimal import Decimal
from django.db import transaction
from .fsm import TollStateMachine

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

    fsm = TollStateMachine()

    try:
        vehicle = Vehicle.objects.get(
            rfid_tag=rfid_tag,
            is_active=True
        )

    except Vehicle.DoesNotExist:

        return {
            "success": False,
            "state": "UNKNOWN_RFID",
            "message": "Vehicle not found or inactive"
        }

    # -------------------------
    # 2. VEHICLE IDENTIFIED
    # -------------------------

    fsm.transition("IDENTIFIED")

    # -------------------------
    # 3. VEHICLE VERIFIED
    # -------------------------

    fsm.transition("VERIFIED")

    # -------------------------
    # 4. CALCULATE TOLL
    # -------------------------

    amount = calculate_toll(
        vehicle,
        toll_plaza
    )

    if amount is None:

        return {
            "success": False,
            "state": "TOLL_CALCULATED",
            "message": "No toll rule found"
        }

    fsm.transition("TOLL_CALCULATED")

    # -------------------------
    # 5. PAYMENT PROCESSING
    # -------------------------

    fsm.transition("PAYMENT_PROCESSING")
    try:
        wallet = vehicle.owner.wallet
    except Exception:
        return {
            "success": False,
            "state": "PAYMENT_FAILED",
            "message": "Wallet not found"
        }

    if wallet.balance < amount:

        transaction_record = TollTransaction.objects.create(
            vehicle=vehicle,
            toll_plaza=toll_plaza,
            amount=amount,
            status="FAILED",
            state="INSUFFICIENT_BALANCE",
            failure_reason="Insufficient wallet balance"
        )

        return {
            "success": False,
            "state": "INSUFFICIENT_BALANCE",
            "message": "Insufficient wallet balance",
            "transaction": transaction_record
        }

    # -------------------------
    # 7. PAYMENT SUCCESS
    # -------------------------

    with transaction.atomic():

        wallet.balance -= amount
        wallet.save()

        fsm.transition("PASSED")

        transaction_record = TollTransaction.objects.create(
            vehicle=vehicle,
            toll_plaza=toll_plaza,
            amount=amount,
            status="SUCCESS",
            state=fsm.state
        )

    return {
        "success": True,
        "state": fsm.state,
        "message": "Toll payment successful",
        "amount": amount,
        "transaction": transaction_record
    }