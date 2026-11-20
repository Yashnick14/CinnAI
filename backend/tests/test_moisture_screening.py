"""ADC boundary and serialization checks without network or model initialization."""
from datetime import timedelta
from pathlib import Path
import re
import pytest
from app.cloud.moisture import ADC_THRESHOLD, ADC_UNTOUCHED_THRESHOLD, screening_status
from app.cloud.models import Reading, now
from app.cloud.routes import reading_json

@pytest.mark.parametrize("adc,status", [(0,"FAIL_PROVISIONAL"),(1710,"FAIL_PROVISIONAL"),(1711,"PASS_PROVISIONAL"),(2849,"PASS_PROVISIONAL"),(2850,"UNTOUCHED"),(2975,"UNTOUCHED"),(4095,"UNTOUCHED")])
def test_screening_and_api_boundaries(adc,status):
    at = now()
    reading = Reading(id="test",device_id="probe",event_id="event",adc=adc,received_at=at)
    result = reading_json(reading, at)
    assert screening_status(adc) == result["status"] == status
    assert result["adc"] == adc and result["percentage"] is None
    assert reading_json(reading, at+timedelta(seconds=30))["stale"] is False
    assert reading_json(reading, at+timedelta(seconds=30.001))["stale"] is True

def test_thresholds_match_firmware_and_frontend():
    root = Path(__file__).resolve().parents[2]
    for path in [root/"frontend/src/config/ble.ts", root/"firmware/CinnamonGradingWifi/CinnamonGradingWifi.ino"]:
        # Runtime-only Docker test images may intentionally exclude other source trees.
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8")
        for name,value in [("ADC_THRESHOLD",ADC_THRESHOLD),("ADC_UNTOUCHED_THRESHOLD",ADC_UNTOUCHED_THRESHOLD)]:
            assert re.search(rf"{name} = {value};", source)
