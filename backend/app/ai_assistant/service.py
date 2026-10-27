"""Isolated lazy assistant. No imports or mutations of visual model services."""
import logging
import os
import re
from pathlib import Path
from threading import Lock

from app.ai_assistant.cinnamon_assistant_final import ask_cinnamon_assistant
from app.ai_assistant.schemas import AssistantAnswer
from app.core.config import PROJECT_ROOT

logger = logging.getLogger(__name__)


class AssistantUnavailable(Exception):
    pass


class AssistantGenerationError(Exception):
    pass


INTERNAL_LANGUAGE = re.compile(
    r"\b(?:rag|retrieval|embeddings?|vectors?|semantic search|gemini|llms?|"
    r"prompts?|context windows?|record ids?|similarity scores?|[RGWP]\d{2})\b", re.I
)


class AssistantService:
    def __init__(self, retriever, client):
        self.retriever = retriever
        self.client = client
        self.lock = Lock()

    @classmethod
    def load(cls):
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            raise AssistantUnavailable("Assistant is not configured. Set GEMINI_API_KEY in backend/.env and restart.")
        try:
            from sentence_transformers import SentenceTransformer
            from google import genai
            from google.genai import types
            from app.ai_assistant.retrieval import Retriever
            cache = PROJECT_ROOT / "data" / "assistant-encoder"
            retriever = Retriever(SentenceTransformer(
                "sentence-transformers/all-MiniLM-L6-v2", cache_folder=str(cache)
            ))
            client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=60000))
            return cls(retriever, client)
        except Exception as exc:
            logger.warning("Assistant initialization failed (%s)", type(exc).__name__)
            raise AssistantUnavailable("Assistant resources are unavailable. Check server configuration.") from exc

    def ask(self, question):
        try:
            # Serialize use of the shared encoder/client without blocking the async loop.
            with self.lock:
                result = ask_cinnamon_assistant(question, self.retriever.retrieve,
                                                self.retriever.documents, self.client)
            answer = (result["answer"] or "").strip()
            if not answer or INTERNAL_LANGUAGE.search(answer):
                raise ValueError("Unsupported public answer")
            return AssistantAnswer(answer=answer, detected_diameter_mm=result["diameter_mm"],
                                   application_grade=result["application_result"])
        except Exception as exc:
            # Never expose provider bodies, credentials, or internal records to clients.
            logger.warning("Assistant answer failed (%s)", type(exc).__name__)
            raise AssistantGenerationError("The assistant could not answer right now. Please try again.") from exc


_service = None
_load_lock = Lock()


def get_assistant_service():
    global _service
    with _load_lock:
        if _service is None:
            _service = AssistantService.load()
        return _service
