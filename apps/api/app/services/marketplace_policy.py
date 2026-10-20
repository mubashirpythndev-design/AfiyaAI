"""Marketplace policy constants and explicitly synthetic demo identities."""
from uuid import NAMESPACE_URL, uuid5

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
