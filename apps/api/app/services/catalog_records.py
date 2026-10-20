"""Normalize supplied catalog records; never infer missing medical facts."""
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any
import re


def value(row: dict, *keys: str, default: Any = "") -> Any:
    return next((row[k] for k in keys if row.get(k) is not None and row[k] != ""), default)


def money(amount: Any) -> Decimal:
    try:
        result = Decimal(str(amount).replace(",", ""))
        if not result.is_finite() or result < 0:
            raise ValueError("Price must be a finite non-negative amount")
        return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError) as exc:
        raise ValueError("Invalid price") from exc


def record_fields(row: dict) -> dict[str, Any]:
    if str(value(row,"currency",default="PKR")).strip().upper() != "PKR":
        raise ValueError("Only PKR catalog prices are supported")
    reg = str(value(row,"drap_reg_no","registration_no","Registration_No")).strip()
    if not reg or len(reg) > 64:
        raise ValueError("A registration number of at most 64 characters is required")
    raw_date = value(row,"effective_date","effective_from","effective from",default=None)
    effective = date.fromisoformat(str(raw_date).strip()) if raw_date else None
    result = {"drap_reg_no":reg,
        "product_name":str(value(row,"product_name","Product_name","brand_name")).strip(),
        "brand_name":str(value(row,"brand_name")).strip(),
        "generic_name":str(value(row,"generic_name","Generic")).strip(),
        "strength":str(value(row,"strength","Strength")).strip(),
        "dosage_form":str(value(row,"dosage_form","Form")).strip(),
        "manufacturer":str(value(row,"manufacturer","Manufacturer")).strip(),
        "category":str(value(row,"category","Category")).strip(),
        "pack_size":str(value(row,"pack_size","Packsize")).strip(),
        "notified_mrp":money(value(row,"notified_mrp","pack_price_pkr","Price",default=None)),
        "effective_date":effective}
    if result["notified_mrp"] > Decimal("99999999.99"):
        raise ValueError("Price exceeds Numeric(10,2)")
    return result


def new_medicine_fields(fields: dict) -> dict:
    product = fields["product_name"]
    form = re.search(r"\b(Tablet|Capsule|Syrup|Injection|Inhaler|Drops|Suspension|Cream|Ointment|Gel|Spray|Suppository|Lotion|Bar)\s*$",product,re.I)
    strength = re.search(r"(?<!\w)\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu|%)(?:\s*/\s*\d*(?:\.\d+)?\s*(?:mcg|mg|g|ml|iu))?",product,re.I)
    end = strength.start() if strength else form.start() if form else len(product)
    parsed = {"brand_name":product[:end].strip(),"strength":strength.group().strip() if strength else "",
              "dosage_form":form.group().strip() if form else ""}
    result = {key:fields[key] or parsed.get(key,"") for key in ("brand_name","strength","dosage_form")}
    # Generic/category/manufacturer must come from supplied data, never a guess.
    result.update({key:fields[key] for key in ("generic_name","category","manufacturer")})
    if not all(result[key] for key in ("brand_name","generic_name","strength","dosage_form")):
        raise ValueError("New medicines require brand/product name, generic, strength and dosage form")
    if any(len(str(result[key])) > limit for key,limit in (("brand_name",255),("generic_name",255),("strength",100),("dosage_form",100),("category",100),("manufacturer",255))):
        raise ValueError("Catalog field exceeds its storage limit")
    result["drap_reg_no"] = fields["drap_reg_no"]
    result["registration_info"] = fields["drap_reg_no"]
    return result
