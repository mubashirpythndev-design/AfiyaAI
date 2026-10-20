"""Validate model OCR results and retain every detected medicine line."""
import json
import re
import math
from app.services.ocr_images import valid_box, map_box
from app.services.pharmaceutical_corrector import correct_and_normalize_candidate

class OCRFormatError(ValueError):
    pass

def parse_ocr_response(text: str, region=None) -> dict:
    text = (text or "").strip()
    if "\x60\x60\x60" in text:
        match = re.search(r"\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}", text)
        text = match.group(1) if match else text
    try:
        payload = json.loads(text)
    except (TypeError, ValueError) as exc:
        raise OCRFormatError("OCR returned malformed JSON; retry the scan.") from exc
    summary = None
    count = None
    complete = False
    if isinstance(payload, dict):
        summary = payload.get("clinical_summary") or payload.get("summary")
        count = payload.get("medicine_line_count")
        complete = payload.get("coverage_complete") is True
        rows = next((payload[k] for k in ["candidates","medicines","drugs","items","prescriptions","extracted_medicines"] if isinstance(payload.get(k),list)), None)
    else:
        rows = payload if isinstance(payload,list) else None
    if rows is None or len(rows) > 80:
        raise OCRFormatError("OCR response must contain a bounded candidate list.")
    if isinstance(count,bool) or not isinstance(count,int) or not 0 <= count <= 80:
        count = None
    candidates = []
    for index, row in enumerate(rows):
        if isinstance(row,str):
            row = {"name":row,"raw_line":row}
        if not isinstance(row,dict):
            row = {"name":"", "raw_line":"Unreadable medicine line"}
        def string(*keys):
            return next((str(row[k]).strip()[:2000] for k in keys if not isinstance(row.get(k), bool) and isinstance(row.get(k), (str,int,float)) and row[k] != ""), "")
        name = string("name","prescription_name","medicine_name")
        line = string("raw_line") or name or "Unreadable medicine line"
        unclear = not name or name.casefold() in {"illegible","unknown","unclear","unreadable"}
        try:
            conf = float(row.get("confidence",0))
            if isinstance(row.get("confidence"), bool) or not math.isfinite(conf) or not 0 <= conf <= 1: conf = 0.0
        except (TypeError,ValueError):
            conf = 0.0
        box = map_box(row.get("bbox"),region) if row.get("bbox") is not None else region
        if unclear:
            candidate = {"raw_text":"Unreadable medicine — review required", "raw_line":line, "confidence":0.0, "is_verified":False,
                         "matched_medicine":None, "needs_confirmation":True, "detected_brand":None, "detected_strength":string("strength"),
                         "detected_form":string("form") or None, "unreadable":True, "original_name":name or None}
        else:
            candidate = correct_and_normalize_candidate(name=name,strength=string("strength"),form=string("form"),frequency=string("frequency"),
                instructions=string("instructions","directions","dosage_instruction","dosage"), confidence=conf,raw_line=line,
                clinical_purpose=string("clinical_purpose","purpose","use","indication"))
            candidate["unreadable"] = not bool(candidate.get("original_name"))
            if candidate["unreadable"]:
                candidate["raw_text"] = "Unreadable medicine — review required"
                candidate["confidence"] = 0.0
        candidate["bbox"] = box
        candidate["line_id"] = str(row.get("line_id") or f"line-{index+1}")[:100]
        candidate["reviewed"] = False
        candidates.append(candidate)
    # Preserve a visible placeholder for each reported but unreturned medicine line.
    for index in range(max(0,(count or 0)-len(candidates))):
        candidates.append({"raw_text":"Missing medicine line — review required", "raw_line":"The model counted a medicine line but did not return its name.",
            "confidence":0.0,"is_verified":False,"unreadable":True,"needs_confirmation":True,"bbox":region,"line_id":f"missing-{index+1}","reviewed":False})
    return {"candidates":candidates,"clinical_summary":str(summary)[:10000] if summary else None,"medicine_line_count":count,
            "coverage_complete":complete and count is not None and count == len(rows) and not any(c.get("unreadable") for c in candidates)}

def _overlap(a,b):
    if not a or not b: return False
    area = max(0,min(a[2],b[2])-max(a[0],b[0])) * max(0,min(a[3],b[3])-max(a[1],b[1]))
    smaller = min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]))
    return smaller > 0 and area/smaller > 0.5

def _reading_key(candidate: dict) -> tuple[str, str, str]:
    """Compare image readings before catalog spelling corrections hide differences."""
    name = candidate.get("original_name") or candidate.get("detected_brand") or candidate.get("detected_generic") or candidate.get("raw_text")
    return tuple(str(value or "").strip().casefold() for value in
                 (name, candidate.get("detected_strength"), candidate.get("detected_form")))


def merge_candidates(existing: list[dict], additions: list[dict], *, corroborate: bool = False) -> list[dict]:
    result = [dict(c) for c in existing]
    matched: set[int] = set()
    for candidate in additions:
        same = None
        best_overlap = -1.0
        # Each source line can match only one line in this reading. Broad or
        # shifted boxes must not collapse two medication entries into one.
        for i, old in enumerate(result[:len(existing)]):
            if i in matched:
                continue
            same_box = _overlap(old.get("bbox"),candidate.get("bbox"))
            same_line = (old.get("raw_line") or "").casefold() == (candidate.get("raw_line") or "").casefold()
            same_name = (old.get("raw_text") or "").casefold() == (candidate.get("raw_text") or "").casefold()
            if same_box or (same_line and same_name and not (old.get("bbox") and candidate.get("bbox"))):
                score = 0.0
                if same_box:
                    a, b = old["bbox"], candidate["bbox"]
                    intersection = max(0,min(a[2],b[2])-max(a[0],b[0])) * max(0,min(a[3],b[3])-max(a[1],b[1]))
                    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection
                    score = intersection / union if union else 0.0
                if score > best_overlap:
                    same, best_overlap = i, score
        if same is not None:
            matched.add(same)
        candidate = dict(candidate)
        candidate["needs_confirmation"] = True  # recovered/different readings are reviewed against the image
        if same is None:
            candidate["line_id"] = f"recovered-{len(result)+1}"
            result.append(candidate)
        elif result[same].get("unreadable") and not candidate.get("unreadable"):
            candidate["line_id"] = result[same].get("line_id")
            result[same] = candidate
        elif not candidate.get("unreadable") and not result[same].get("unreadable") and _reading_key(candidate) != _reading_key(result[same]):
            # Disagreement is visible rather than silently choosing a new medicine.
            old = result[same]
            alternative = old.get("_alternative_candidate")
            if (corroborate and alternative and _reading_key(alternative) == _reading_key(candidate)
                    and candidate.get("confidence", 0) >= 0.8 and alternative.get("confidence", 0) >= 0.8
                    and not candidate.get("correction_suggestion") and not alternative.get("correction_suggestion")):
                # A blind full-page reading and a detail reading agree. Prefer that
                # reading but retain the first one visibly and require human review.
                candidate["line_id"] = old.get("line_id")
                candidate["bbox"] = old.get("bbox") or candidate.get("bbox")
                candidate["alternative_reading"] = old.get("raw_text")
                # Directions generated for the rejected reading (e.g. tablets for
                # a bar) must not be carried onto the preferred name/form.
                candidate["dosage_instruction"] = None
                candidate["clinical_purpose"] = old.get("clinical_purpose")
                result[same] = candidate
            else:
                old["needs_confirmation"] = True
                old["alternative_reading"] = candidate.get("raw_text")
                old["_alternative_candidate"] = candidate
    return result
