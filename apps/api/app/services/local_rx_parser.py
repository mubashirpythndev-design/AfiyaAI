"""Conservative prescription-line selection; catalog suggestions never rewrite ink."""
import math
import re
from collections.abc import Iterable

from rapidfuzz.fuzz import ratio

STRENGTH = re.compile(r"\b\d+(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?\s*(?:mcg|mg|g|ml|iu|%)(?!\w)", re.I)
FORM = re.compile(r"\b(?:tablets?|tabs?|capsules?|caps?|inhalers?|syrups?|syp|suspension|susp|ampoules?|injections?|inj|drops?|creams?|gels?|sachets?|lotions?|bars?|soap|ointments?|sprays?|shampoo|solutions?|wash|mouthwash|powders?|patch(?:es)?|suppositor(?:y|ies)|pessar(?:y|ies)|paste|foam|emulsion)\b\.?", re.I)
FREQUENCY = re.compile(r"\b(?:OD|BD|TDS|QID|HS|SOS|PRN|daily|once|twice)\b|\b[0-9]+\s*[+x]\s*[0-9]+(?:\s*\+\s*[0-9]+)?\b", re.I)
HEADER = re.compile(r"^\s*(?:dr\.?\s|doctor\b|clinic\b|hospital\b|patient\b|name\s*:|age\b|date\b|signature\b|page\b|phone\b|tel\b|mobile\b|address\b|diagnosis\b|follow\s*up\b)", re.I)
NOISE = {"rx", "take", "use", "apply", "daily", "once", "twice", "tablet", "capsule", "for", "days", "weeks", "morning", "night", "after", "before", "food", "and", "the"}


def _name_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def _catalog_overlap(name: str, names: Iterable[str], *, fuzzy: bool = True) -> bool:
    key = _name_key(name)
    if len(key) < 3:
        return False
    for entry in names:
        other = _name_key(entry)
        if len(other) < 3:
            continue
        if key == other or re.search(r"(?<!\w)" + re.escape(other) + r"(?!\w)", key):
            return True
        if fuzzy and ratio(key, other) >= 90:
            return True
    return False


def join_text_fragments(rows: list, width: int, height: int) -> list[dict]:
    """Join nearby horizontal fragments without combining distant prescription columns."""
    fragments = []
    for row in rows[:1000]:
        try:
            points, text, confidence = row
            score = float(confidence)
            if not isinstance(text, str) or not text.strip() or not math.isfinite(score):
                continue
            xs, ys = [float(p[0]) for p in points], [float(p[1]) for p in points]
            if not all(math.isfinite(v) for v in xs + ys):
                continue
            fragments.append({"text": text.strip()[:2000], "confidence": max(0, min(1, score)),
                              "rect": [min(xs), min(ys), max(xs), max(ys)]})
        except (TypeError, ValueError, IndexError):
            continue
    groups: list[dict] = []
    for part in sorted(fragments, key=lambda p: (p["rect"][1], p["rect"][0])):
        left, top, right, bottom = part["rect"]
        group = next((g for g in reversed(groups) if
                      min(bottom, g["rect"][3]) - max(top, g["rect"][1]) > .6 * min(bottom-top, g["rect"][3]-g["rect"][1])
                      and 0 <= left-g["rect"][2] <= max(25, (bottom-top)*2.5)
                      and not (STRENGTH.search(g["text"]) and STRENGTH.search(part["text"]))), None)
        if group is None:
            groups.append(dict(part))
        else:
            group["text"] += " " + part["text"]
            group["confidence"] = min(group["confidence"], part["confidence"])
            group["rect"] = [group["rect"][0], min(top, group["rect"][1]), right, max(bottom, group["rect"][3])]
    for group in groups:
        left, top, right, bottom = group.pop("rect")
        group["bbox"] = [max(0, min(1000, int(value))) for value in
                         (top*1000/max(1,height), left*1000/max(1,width), bottom*1000/max(1,height), right*1000/max(1,width))]
    return groups


def _parse_rx_lines_to_medicines(lines: list[dict], catalog_names: Iterable[str] = (), *, tokens_only: bool = False) -> list[dict]:
    """Retain unknown products with Rx evidence; never synthesize missing strength/form."""
    names = tuple(catalog_names)
    candidates = []
    for index, line in enumerate(lines):
        raw = line["text"].strip()
        clean = re.sub(r"^\s*(?:\d+[.)]\s*|[℞#]\s*|R[x/]\s*[:.-]?\s*)", "", raw, flags=re.I)
        if HEADER.search(clean) or not re.search(r"[a-zA-Z]{2}", clean):
            continue
        strength = STRENGTH.search(clean)
        form = FORM.search(clean)
        frequency = FREQUENCY.search(clean)
        name = FORM.sub(" ", clean)
        name = STRENGTH.sub(" ", name)
        name = FREQUENCY.split(name, maxsplit=1)[0]
        name = re.split(r"\b(?:for|after|before|with|without|take|apply|use)\b", name, maxsplit=1, flags=re.I)[0]
        name = re.sub(r"^\s*\d+\s+", "", name).strip(" .,:;-+/")
        words = _name_key(name).split()
        if not words or all(word in NOISE or word.isdigit() for word in words):
            continue
        catalog_hit = _catalog_overlap(name, names, fuzzy=not tokens_only)
        rx_prefix = bool(re.match(r"\s*(?:℞|Rx\b|R/)", raw, re.I))
        if tokens_only and not catalog_hit:
            continue
        if not (strength or form or frequency or rx_prefix or catalog_hit):
            continue
        instructions = clean[frequency.start():].strip() if frequency else None
        candidates.append({"raw_text": raw, "raw_line": raw, "original_name": name,
                           "detected_brand": name, "detected_generic": None,
                           "detected_strength": strength.group().replace(" ", "") if strength else None,
                           "detected_form": form.group().strip(".") if form else None,
                           "dosage_instruction": instructions, "confidence": line["confidence"],
                           "is_verified": False, "matched_medicine": None, "needs_confirmation": True,
                           "reviewed": False, "unreadable": False, "line_id": f"local-{index+1}",
                           "bbox": line.get("bbox")})
        if len(candidates) >= 80:
            break
    return candidates
