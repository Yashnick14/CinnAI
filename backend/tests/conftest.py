import pytest


@pytest.fixture(autouse=True)
def isolate_evaluation_collection(monkeypatch, tmp_path):
    # Automated fixtures must never enter the independent real-world collection.
    monkeypatch.setattr("app.services.v5_capture_log.COLLECTION_DIRECTORY", tmp_path / "v5")
