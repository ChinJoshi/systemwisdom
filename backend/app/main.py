from typing import Annotated

from app.api_models import AuthenticatedUser, MeResponse
from app.security import authenticated_user
from fastapi import APIRouter, Depends, FastAPI
from fastapi.routing import APIRoute


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


app.include_router(api_router)
