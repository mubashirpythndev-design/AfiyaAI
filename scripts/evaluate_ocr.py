"""Offline prescription OCR evaluation against pharmacist-reviewed reference JSON.
Usage: python scripts/evaluate_ocr.py reference.json predictions.json
No images, network requests or model calls are made by this script.
"""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re

def normalized(value):
    return re.sub(r"\s+", "", str(value or "").casefold())

def evaluate(reference, predictions):
    if not isinstance(reference, list) or not isinstance(predictions, list):
        raise ValueError("Both inputs must be arrays of prescription records.")
    def indexed(rows):
        result={}
        for row in rows:
            if not isinstance(row,dict) or not isinstance(row.get("id"),str) or not row["id"] or row["id"] in result:
                raise ValueError("Each prescription needs a unique nonempty string id.")
            if not isinstance(row.get("medicines"),list): raise ValueError("Each prescription needs a medicines array.")
            for med in row["medicines"]:
                if not isinstance(med,dict): raise ValueError("Each medicine must be an object.")
            result[row["id"]]=row
        return result
    refs=indexed(reference); preds=indexed(predictions)
    if not refs: raise ValueError("Reference set must not be empty.")
    if set(preds)-set(refs): raise ValueError("Prediction ids must belong to the reference set.")
    totals=Counter(); details=[]; latencies=[]; calls=[]
    for ident, record in refs.items():
        truth=record["medicines"]; prediction=preds.get(ident,{}); found=prediction.get("medicines",[])
        expected=Counter(normalized(m.get("name")) for m in truth if normalized(m.get("name")))
        observed=Counter(normalized(m.get("name")) for m in found if normalized(m.get("name")) and not m.get("unreadable"))
        matched=sum((expected & observed).values()); missed=sum((expected-observed).values()); added=sum((observed-expected).values())
        # Match repeated names by exact attributes first, then compare unmatched occurrences.
        by_name=defaultdict(list)
        for med in found:
            if not med.get("unreadable") and normalized(med.get("name")): by_name[normalized(med["name"])].append(med)
        wrong_strength=wrong_form=0
        for med in truth:
            choices=by_name[normalized(med.get("name"))]
            if not choices: continue
            index=next((i for i,c in enumerate(choices) if all(normalized(c.get(k))==normalized(med.get(k)) for k in ["strength","form"])),0)
            actual=choices.pop(index)
            wrong_strength+=bool(normalized(med.get("strength")) and normalized(actual.get("strength"))!=normalized(med["strength"]))
            wrong_form+=bool(normalized(med.get("form")) and normalized(actual.get("form"))!=normalized(med["form"]))
        unreadable=sum(bool(m.get("unreadable")) or not normalized(m.get("name")) for m in found)
        complete=not(missed or added or wrong_strength or wrong_form or unreadable) and ident in preds
        totals.update(expected=sum(expected.values()),observed=sum(observed.values()),matched=matched,missed=missed,added=added,wrong_strength=wrong_strength,wrong_form=wrong_form,unreadable=unreadable,complete=int(complete))
        details.append({"id":ident,"missed":missed,"added":added,"wrong_strength":wrong_strength,"wrong_form":wrong_form,"unreadable":unreadable,"complete_correct":complete})
        for key,destination in [("latency_ms",latencies),("provider_attempts",calls)]:
            value=prediction.get(key)
            if isinstance(value,(int,float)) and not isinstance(value,bool) and value>=0: destination.append(value)
    return {"prescriptions":len(refs),"missing_predictions":len(set(refs)-set(preds)),"name_recall":totals["matched"]/totals["expected"] if totals["expected"] else None,
        "name_precision":totals["matched"]/totals["observed"] if totals["observed"] else None,"complete_correct_rate":totals["complete"]/len(refs),
        "counts":dict(totals),"mean_latency_ms":sum(latencies)/len(latencies) if latencies else None,"mean_provider_attempts":sum(calls)/len(calls) if calls else None,"details":details}

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("reference",type=Path);parser.add_argument("predictions",type=Path);args=parser.parse_args()
    try:
        print(json.dumps(evaluate(json.loads(args.reference.read_text(encoding="utf-8")),json.loads(args.predictions.read_text(encoding="utf-8"))),indent=2,allow_nan=False))
    except (ValueError,OSError) as exc: parser.exit(2,str(exc)+"\n")
