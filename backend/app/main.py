from typing import Annotated

from app.api_models import AuthenticatedUser, CodebaseResponse, MeResponse
from app.db.db import Session
from app.db.db_models import Codebase
from app.security import authenticated_user
from fastapi import APIRouter, Depends, FastAPI
from fastapi.routing import APIRoute
from sqlalchemy import select


# Use the route function name as the OpenAPI operationId (e.g. `get_me`) so the
# generated TypeScript SDK gets clean function names (`getMe`). Route function
# names must therefore be unique across the app.
def generate_operation_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    generate_unique_id_function=generate_operation_id,
)

api_router = APIRouter(prefix="/api")


@api_router.get("/me")
def get_me(
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> MeResponse:
    return MeResponse(user_id=user.user_id)


@api_router.get("/codebases")
def list_codebases(
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> list[CodebaseResponse]:
    with Session() as session:
        codebases = session.scalars(
            select(Codebase)
            .where(Codebase.user_id == user.user_id)
            .order_by(Codebase.created_at.desc())
        ).all()
        return [CodebaseResponse.model_validate(c) for c in codebases]


app.include_router(api_router)
