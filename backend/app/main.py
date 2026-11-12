from typing import Annotated

from app.api_models import AuthenticatedUser, MeResponse
from app.security import authenticated_user
from fastapi import APIRouter, Depends, FastAPI

app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")

api_router = APIRouter(prefix="/api")


@api_router.get("/me")
def get_me(
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> MeResponse:
    return MeResponse(user_id=user.user_id)


app.include_router(api_router)
