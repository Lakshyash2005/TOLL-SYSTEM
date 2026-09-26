class TollStateMachine:
    VALID_TRANSITIONS= {
      "DETECTED" : ["IDENTIFIED", "UNKNOWN_RFID"],
      "IDENTIFIED":["VERIFIED", "INVALID_VEHICLE"],
      "VERIFIED":["TOLL_CALCULATED"],
      "TOLL_CALCULATED":["PAYMENT_PROCESSING"],
      "PAYMENT_PROCESSING":[
        "PASSED",
        "INSUFFICIENT_BALANCE",
        "PAYMENT_FAILED"
      ],
      "PASSED": [],
      "UNKNOW_RFID":[],
      "INVALID_VEHICLE": [],
      "INSUFFICIENT_BALANCE":[],
      "PAYMENT_FAILED ":[],
          }
    def _init_(self ,  initial_state="DETECTED"):
        self.state = initial_state
    def transactions(self, next_state):
        allowed_states = self.VALID_TRANSITIONS.get(
            self.state,
            []
        )
    if next_state not in allowed_states:
        raise ValueError(
            f"Invalid transition:"
            f"{self.state} -> {next_state}"
        )

    self.state = next_state
    return self.state