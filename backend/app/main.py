from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI

from app.api_models import AuthenticatedUser, MeResponse
from app.security import authenticated_user

app = FastAPI()

api_router = APIRouter(prefix="/api")


@api_router.get("/me")
def get_me(
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> MeResponse:
    return MeResponse(user_id=user.user_id)


app.include_router(api_router)
