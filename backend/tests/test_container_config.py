"""Container overrides must preserve local defaults and stay independent of grading."""
import json
import os
from pathlib import Path
import subprocess
import sys


def config_in_process(overrides):
    env = os.environ.copy()
    for key in ("ASSISTANT_ENCODER_PATH", "ASSISTANT_ENCODER_CACHE", "V5_COLLECTION_DIRECTORY"):
        env.pop(key, None)
    env.update(overrides)
    script = "from app.core import config as c; import json; print(json.dumps([c.ASSISTANT_ENCODER_PATH, str(c.ASSISTANT_ENCODER_CACHE), str(c.V5_COLLECTION_DIRECTORY), str(c.PROJECT_ROOT)]))"
    return json.loads(subprocess.check_output([sys.executable, "-B", "-c", script], env=env, text=True))


def test_container_paths_are_overridable(tmp_path):
    values = config_in_process({"ASSISTANT_ENCODER_PATH": str(tmp_path / "minilm"),
        "ASSISTANT_ENCODER_CACHE": str(tmp_path / "cache"), "V5_COLLECTION_DIRECTORY": str(tmp_path / "captures")})
    assert values[:3] == [str(tmp_path / name) for name in ("minilm", "cache", "captures")]


def test_local_defaults_preserved():
    name, cache, captures, root = config_in_process({})
    assert name == "sentence-transformers/all-MiniLM-L6-v2"
    assert Path(cache) == Path(root) / "data" / "assistant-encoder"
    assert Path(captures) == Path(root) / "backend_handoff" / "realworld_v5_collection"
