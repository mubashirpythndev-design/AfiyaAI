"""Pure MRP comparison service (Phase-1 Feature A, spec 09 §6).

``compare(price_paid, notified_mrp) -> CompareResult(status, amount)``

Pure function: no I/O, no DB, no LLM — exact Decimal arithmetic in code
(spec 08: prices and statuses never come from the model).
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

STATUS_OVERCHARGED = "OVERCHARGED"
STATUS_OK_AT_MRP = "OK_AT_MRP"
STATUS_BELOW_MRP = "BELOW_MRP"
STATUS_NO_DATA = "NO_DATA"

_TWO_PLACES = Decimal("0.01")


@dataclass(frozen=True)
class CompareResult:
    status: str
    amount: Decimal  # price_paid - notified_mrp (>0 overcharge, <0 discount)


def compare(price_paid: Decimal | float | str, notified_mrp: Decimal | float | str) -> CompareResult:
    """Classify a paid price against the DRAP-notified MRP.

    Returns OVERCHARGED when paid > MRP, OK_AT_MRP when equal,
    BELOW_MRP when paid < MRP. ``amount`` is the exact signed difference
    quantized to 2 decimal places.
    """
    paid = Decimal(str(price_paid)).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
    mrp = Decimal(str(notified_mrp)).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
    diff = paid - mrp

    if diff > 0:
        status = STATUS_OVERCHARGED
    elif diff == 0:
        status = STATUS_OK_AT_MRP
    else:
        status = STATUS_BELOW_MRP

    return CompareResult(status=status, amount=diff)
