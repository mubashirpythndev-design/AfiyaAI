"""Validate offline evaluation metrics with synthetic data, not model accuracy."""
import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location("ocr_benchmark",Path(__file__).resolve().parents[3]/"scripts"/"evaluate_ocr.py")
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
evaluate=module.evaluate

def test_metrics_distinguish_missing_added_wrong_attributes():
    truth=[{"id":"a","medicines":[{"name":"Panadol","strength":"500mg","form":"Tablet"},{"name":"Risek","strength":"20mg","form":"Capsule"}]}]
    found=[{"id":"a","medicines":[{"name":"Panadol","strength":"250mg","form":"Syrup"},{"name":"Invented"},{"name":"","unreadable":True}],"latency_ms":100,"provider_attempts":2}]
    result=evaluate(truth,found)
    assert result["name_recall"]==.5 and result["name_precision"]==.5
    assert result["counts"]["missed"]==1 and result["counts"]["added"]==1
    assert result["counts"]["wrong_strength"]==1 and result["counts"]["wrong_form"]==1
    assert result["counts"]["unreadable"]==1 and result["complete_correct_rate"]==0
    assert result["mean_latency_ms"]==100 and result["mean_provider_attempts"]==2

def test_repeated_name_attributes_and_missing_prescription():
    medicines=[{"name":"A","strength":"1mg","form":"Tablet"},{"name":"A","strength":"2mg","form":"Tablet"}]
    truth=[{"id":"a","medicines":medicines},{"id":"b","medicines":[{"name":"B"}]}]
    result=evaluate(truth,[{"id":"a","medicines":medicines[::-1]}])
    assert result["counts"]["wrong_strength"]==0 and result["counts"]["missed"]==1
    assert result["missing_predictions"]==1 and result["complete_correct_rate"]==.5

@pytest.mark.parametrize("truth,predictions",[([],[]),([{"id":"a","medicines":[]}],[{"id":"b","medicines":[]}]),([{"id":"a","medicines":[]},{"id":"a","medicines":[]}],[])])
def test_bad_dataset_rejected(truth,predictions):
    with pytest.raises(ValueError): evaluate(truth,predictions)
