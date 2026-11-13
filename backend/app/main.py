import uuid
from typing import Annotated

from app.api_models import (
    AuthenticatedUser,
    CodebaseResponse,
    CreateCodebaseRequest,
    MeResponse,
)
from app.db.db import Session
from app.db.db_models import Codebase
from app.security import authenticated_user, verified_signature
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert


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


@api_router.get("/codebases/{codebase_id}")
def get_codebase(
    codebase_id: uuid.UUID,
    user: Annotated[AuthenticatedUser, Depends(authenticated_user)],
) -> CodebaseResponse:
    with Session() as session:
        codebase = session.scalar(
            select(Codebase).where(
                Codebase.id == codebase_id, Codebase.user_id == user.user_id
            )
        )
        if codebase is None:
            raise HTTPException(status_code=404, detail="Codebase not found")
        return CodebaseResponse.model_validate(codebase)


# Called by the frontend's Vercel Blob upload callback (not by browsers) after a codebase zip has
# finished uploading. Idempotent: Vercel Blob may deliver the same callback more than once, so a
# repeat delivery for an existing codebase returns that codebase instead of failing.
@api_router.post(
    "/internal/codebases",
    status_code=201,
    dependencies=[Depends(verified_signature)],
)
def create_codebase(body: CreateCodebaseRequest) -> CodebaseResponse:
    with Session() as session:
        session.execute(
            insert(Codebase)
            .values(
                id=body.id,
                user_id=body.user_id,
                name=body.name,
                blob_uri=body.blob_uri,
            )
            .on_conflict_do_nothing(index_elements=[Codebase.id])
        )
        codebase = session.get_one(Codebase, body.id)
        # The id was already taken by a different upload (a replayed id or a UUID collision).
        if codebase.user_id != body.user_id or codebase.blob_uri != body.blob_uri:
            raise HTTPException(status_code=409, detail="Codebase id already in use")
        response = CodebaseResponse.model_validate(codebase)
        session.commit()
        return response


app.include_router(api_router)
