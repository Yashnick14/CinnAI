# Active model artifacts

Configured by `app/core/config.py`. Binary contents unchanged by the refactor.

- `quill_detector_v5.pt` — SHA256 `78a09c742380691bbc53a60e866656aa3b529a171f5aad459125d7adf4c80f1f`
- `coin_quill_segmentation.pt` — SHA256 `4ce2b6106517a7b8168a507fe50aad3c74a576e1546f534eb18544cae06ad9f9`
- `rf_vision_8_class.pkl` — SHA256 `7f87c62c025d332965c20d2f0075673471810dd5fef9a4c37efd7c2558d9f245`

Detector: task detect, Quill class 0. Segmentation: task segment, Coin 0 / Quill 1. RF: 21 features, eight classes. Old backups remain in backend_handoff and are not runtime defaults.
