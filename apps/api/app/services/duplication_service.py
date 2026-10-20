"""Conservative, deterministic identity resolution and therapeutic screening."""
import re
import unicodedata
from collections import defaultdict
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import Medicine
from app.services.duplication_messages import localize


def normalized(value: str | None) -> str:
    return re.sub(r"[^\w]+", "", unicodedata.normalize("NFKC", value or "").casefold())


def medicine_info(med: Medicine) -> dict[str, Any]:
    return {"medicine_id": med.id, "brand_name": med.brand_name, "generic_name": med.generic_name,
            "strength": med.strength, "dosage_form": med.dosage_form, "category": med.category}


async def check_duplications(db: AsyncSession, items_or_names: list[Any], lang: str = "en") -> dict[str, Any]:
    """Only unique exact IDs/names/aliases resolve; fuzzy guesses are never accepted."""
    medicines = list((await db.scalars(select(Medicine))).all())
    by_id = {m.id: m for m in medicines}
    resolved: list[Medicine] = []
    unresolved, ambiguous = [], []
    for item in items_or_names:
        if isinstance(item, Medicine):
            matches = [by_id[item.id]] if item.id in by_id else []
            query = str(item.id)
        else:
            if hasattr(item, "model_dump"):
                item = item.model_dump(exclude_none=True)
            explicit_id = item.get("medicine_id") if isinstance(item, dict) else None
            query = str(explicit_id or (item.get("medicine_query") or item.get("name") or "" if isinstance(item, dict) else item)).strip()
            if explicit_id or query in by_id:
                matches = [by_id[query]] if query in by_id else []
            else:
                key = normalized(query)
                matches = []
                for med in medicines:
                    labels = [med.brand_name, f"{med.brand_name} {med.strength}", f"{med.brand_name} {med.strength} {med.dosage_form}",
                              med.generic_name, f"{med.generic_name} {med.strength}", *(med.aliases or [])]
                    if key and any(key == normalized(label) for label in labels):
                        matches.append(med)
        if len(matches) == 1:
            resolved.append(matches[0])
        elif matches:
            ambiguous.append({"input": query, "candidates": [medicine_info(m) for m in matches]})
        else:
            unresolved.append(query)
    generics: dict[str, list[Medicine]] = defaultdict(list)
    categories: dict[str, list[Medicine]] = defaultdict(list)
    for med in resolved:
        generic, category = normalized(med.generic_name), normalized(med.category)
        if generic and generic not in {"unknown", "unspecified", "na"}:
            generics[generic].append(med)
            if category and category not in {"unknown", "unspecified", "other", "na"}:
                categories[category].append(med)
    same_generic, same_class = [], []
    for members in generics.values():
        if len(members) >= 2:
            group = members[0].generic_name
            same_generic.append({"type":"same_generic", "severity":"HIGH", "generic_name":group,
                "medicines":[medicine_info(m) for m in members], "message":localize("same_generic",lang,group=group)})
    for members in categories.values():
        # Emit only cross-generic pairs: no same-generic pair is warned twice.
        pairs = [[medicine_info(a),medicine_info(b)] for i,a in enumerate(members) for b in members[i+1:]
                 if normalized(a.generic_name) != normalized(b.generic_name)]
        if pairs:
            involved = {m["medicine_id"] for pair in pairs for m in pair}
            same_class.append({"type":"same_class", "severity":"MODERATE", "category":members[0].category,
                "medicines":[medicine_info(m) for m in members if m.id in involved], "pairs":pairs,
                "message":localize("same_class",lang,group=members[0].category)})
    found = bool(same_generic or same_class)
    return {"has_duplication":found, "same_generic_alerts":same_generic, "same_class_alerts":same_class,
            "unresolved":unresolved, "ambiguous":ambiguous, "message":localize("found" if found else "clear",lang),
            "disclaimer":localize("disclaimer",lang)}
