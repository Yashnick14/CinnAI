"""Conservative extraction: only explicit single-sample diameter statements."""
import re
import math

NUMBER = r"(?P<value>\d+(?:\.\d+)?)\s*mm\b"
PATTERNS = [
    rf"\b(?:my|this|our)\s+(?:cinnamon\s+)?(?:quill|sample)(?:\s+has)?(?:\s+a)?(?:\s+measured)?(?:\s+diameter)?(?:\s+of|\s+is|\s+measures|\s*=|\s*:)\s*(?:exactly\s+)?{NUMBER}",
    rf"\bmeasured\s+diameter\s*(?:is|of|=|:)\s*(?:exactly\s+)?{NUMBER}",
    rf"\bwhat\s+grade\s+is\s+(?:exactly\s+)?{NUMBER}",
    rf"\bwhy\s+is\s+{NUMBER}\s+classified\b",
]


def extract_diameter_mm(question: str) -> float | None:
    values = []
    for clause in re.split(r"[;!?]|\.(?!\d)|\bbut\b", question.lower()):
        # A policy quote must not become a measurement, even if it quotes a question.
        if re.search(r"\b(handbook|reference|policy|range|says|states|quoted?)\b", clause):
            continue
        for pattern in PATTERNS:
            for match in re.finditer(pattern, clause):
                value = float(match.group("value"))
                if value > 0 and math.isfinite(value):
                    values.append(value)
    # Multiple distinct samples need clarification, not an arbitrary first match.
    unique = set(values)
    return unique.pop() if len(unique) == 1 else None
