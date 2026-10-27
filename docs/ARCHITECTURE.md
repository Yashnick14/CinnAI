# Runtime and retained legacy code

## Active call graph

`main -> api/routes -> services/sample_decision -> services/diameter_service -> ml/measurement/segmentation_diameter -> ml/segmentation/service`.
Visual requests use `ml/visual/service` and `ml/visual/feature_extraction`.
The V5 detector remains coupled to the visual service intentionally: splitting inference would risk changing behavior.
Assistant routes use `app/ai_assistant`; its artifact files moved intact.

## Measurement authority

`app/ml/measurement/segmentation_diameter.py` is the active implementation.
`config.py::diameter_grade` is the authoritative grade function and calibration configuration.
`controlled.py` retains the old OpenCV/Lab comparison implementation AND the active capture Geometry schema.
`coin_diagnostics.py` and `quill_edges.py` support that comparison path; tests still exercise it.
Do not delete these modules merely because segmentation is the default.
Older `coin_reference.py` and `diameter.py` are retained scaffolding, not the active endpoint.
The old `core/config.py::DIAMETER_RULES` dictionary is inactive legacy configuration; do not use it as application policy.

## Legacy candidates retained for later removal

- `app/api/routes/grading.py`: older unmounted grading router.
- `app/services/grading_service.py`, `image_store.py`: older grading/database path.
- `app/database.py`, `app/models`, `app/repositories`: database scaffolding used by that unmounted router.
- `legacy/ml`: old detector/RF/hybrid/feature placeholders moved out of the active ML package.
- Frontend mock services remain available for explicitly configured hardware-free testing; do not treat all mocks as dead code.
- Old display components and platform-specific history storage remain unchanged pending a separate behavior audit.

Tests are required CI source. Experiments/scripts are reproducibility source, excluded from production images.
Existing bulk data and backup artifacts remain excluded; prior cleanup deletions were blocked by the execution environment.
External evidence is in the sibling `CinnamonHybridGrading_FYP_Evidence` directory, not runtime imports.

## Remaining deployment work

The backend currently lacks a Firebase token authorization boundary. Native history is user scoped, while existing web history needs a separate isolation review.
These are pre-existing behaviors, deliberately unchanged by this organization-only refactor.
There is no verified Linux Dockerfile/CI artifact-provisioning pipeline yet. Do not infer Azure readiness from folder organization.
