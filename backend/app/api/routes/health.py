from fastapi import APIRouter

router = APIRouter()


# Return the lightweight application health response.
@router.get("/health")
def health():
    return {"status": "ok"}
