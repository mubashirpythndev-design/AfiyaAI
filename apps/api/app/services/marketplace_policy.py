"""Marketplace policy constants and explicitly synthetic demo identities."""
from uuid import NAMESPACE_URL, uuid5
from typing import Any

RX_CATEGORIES = ("antibiotic","fluoroquinolone","cephalosporin","anti-diabetic","antidiabetic",
    "anti-hypertensive","antihypertensive","psychotropic","antidepressant","statin","lipid",
    "steroid","bronchodilator","asthma","respiratory")
DEMO_SELLERS = (
    ("Afiya Central Fulfillment Hub","DSL-SINDH-2026-001","VERIFIED"),
    ("MedTrust Pharmacy Gulshan","DSL-SINDH-2026-002","VERIFIED"),
    ("City Care Medical Store","DSL-SINDH-2026-089","PENDING"),
)


def demo_id(key: str) -> str:
    return str(uuid5(NAMESPACE_URL,"afiya-local-marketplace-demo/" + key))


def requires_rx(category: str | None) -> bool:
    return any(marker in (category or "").casefold() for marker in RX_CATEGORIES)


def demo_seller(seller_id: str | None) -> bool:
    return seller_id in {demo_id(license_no) for _,license_no,_ in DEMO_SELLERS}


def demo_order(order: Any, medicine_ids: list[str], catalog: dict[str, Any]) -> bool:
    """Identify seeded history and orders containing explicitly synthetic stock."""
    if order.user_id == demo_id("buyer") or (order.customer_note or "").startswith("[DEMO]"):
        return True
    return any(entry and entry.seller and demo_seller(entry.seller.id)
               for entry in (catalog.get(medicine_id) for medicine_id in medicine_ids))
