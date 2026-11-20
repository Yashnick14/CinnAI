"""Empirical ADC screening; not a calibrated moisture-percentage conversion."""

ADC_THRESHOLD = 1711
ADC_UNTOUCHED_THRESHOLD = 2850


def screening_status(adc: int) -> str:
    """Keep untouched readings out of moisture PASS/FAIL classification."""
    if adc >= ADC_UNTOUCHED_THRESHOLD:
        return "UNTOUCHED"
    return "PASS_PROVISIONAL" if adc >= ADC_THRESHOLD else "FAIL_PROVISIONAL"
