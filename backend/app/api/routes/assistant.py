from fastapi import APIRouter, HTTPException
from app.ai_assistant.schemas import AssistantAnswer, AssistantQuestion
from app.ai_assistant.service import (
    AssistantGenerationError, AssistantUnavailable, get_assistant_service,
)

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AssistantAnswer)
def ask_assistant(request: AssistantQuestion):
    # FastAPI runs sync handlers in its thread pool (encoding and SDK are synchronous).
    try:
        return get_assistant_service().ask(request.question)
    except AssistantUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AssistantGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
