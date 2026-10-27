# Cinnamon assistant backend

POST `/assistant/ask` accepts `{ "question": "my quill is 19.4 mm" }`.
The response contains only `answer`, `detected_diameter_mm`, and `application_grade`.

From the backend folder:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Set `GEMINI_API_KEY` privately in backend/.env before starting. The existing dotenv loader reads it. The assistant uses `gemini-3.5-flash-lite` through google-genai; no automatic model substitution occurs. An unavailable model/key returns an error, never a fabricated answer.

The first assistant request lazily loads the MiniLM query encoder and existing 62 x 384 matrix plus document/knowledge JSON files. Subsequent requests reuse them once per server process. The first use may download the encoder into backend/data/assistant-encoder. Saved document embeddings are never regenerated. Visual model startup is unchanged.

The supplied Colab ranking boosts and stable ordering are preserved. Scores are combined internal ranking scores and are never public. Grade-related questions include the application policy independently of ranking.

Only explicit single-sample measurement statements invoke the existing diameter_grade function. Policy/reference clauses are excluded. Multiple differing sample measurements and unrecognized/ambiguous wording produce null measurement fields and instructions to clarify; the extractor deliberately favors avoiding false measurement claims. This endpoint does not validate a physical sample or update a grading session.

The deterministic application_grade is never calculated by the language model. Answer generation receives that result plus the handbook/application distinction and existing provisional ADC rule. Generated answers are rejected if empty or if they contain prohibited internal vocabulary/record identifiers. API status: 422 invalid question; 503 assistant not configured/resources unavailable; 502 answer service failure. Provider bodies and credentials are not returned.

Tests use a controlled encoder and answer generator to verify routing, prompts, classification, exact ranking weights, failure handling and public response shape. They do not establish live generated-answer quality. All six requested questions still need a live answer check once a valid API key is configured.

Run tests:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

Historical integration validation (not current environment status):
- 147 backend tests passed (46 assistant tests, 101 existing tests).
- Real MiniLM encoder loaded successfully; saved matrix (62, 384), query vector (1, 384), 12 ranked results.
- pip check: no broken requirements.
- Installed sentence-transformers 5.7.0 and google-genai 1.75.0. The SDK dependency resolved websockets to 16.1.1 (previously 17.2); existing vision dependency pins stayed unchanged.
- GEMINI_API_KEY is absent. Six question tests verify classification/routing/grounding using a controlled generator, not real Gemini answer quality.

Created originally: ai_assistant/measurement_intent.py, ai_assistant/retrieval.py, ai_assistant/schemas.py, ai_assistant/service.py, ai_assistant/README.md, app/api/routes/assistant.py, tests/test_assistant.py.
Modified: ai_assistant/cinnamon_assistant_final.py, app/main.py, requirements.txt, .env.example, tests/test_api.py (only expected route inventory).
Generated ignored runtime files: backend/data/assistant-encoder (downloaded encoder cache) and backend/.venv installed dependencies. Supplied knowledge JSON, embedding matrix/documents and all grading model artifacts were not modified.

Current package location: `backend/app/ai_assistant/`. Knowledge and embeddings moved unchanged. Encoder cache remains `backend/data/assistant-encoder`.
