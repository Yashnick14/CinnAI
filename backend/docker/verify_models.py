"""Fail image build if active artifact bytes differ from the validated originals."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
for name, expected in json.loads((root / "docker/model-sha256.json").read_text()).items():
    actual = hashlib.sha256((root / "models" / name).read_bytes()).hexdigest()
    if actual != expected:
        raise RuntimeError(f"Model SHA256 mismatch: {name}")
print("All three model hashes verified.")
