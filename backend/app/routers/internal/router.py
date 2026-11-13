from app.api_models import CodebaseResponse, CreateCodebaseRequest
from app.db.db import Session
from app.db.db_models import Codebase
from app.security import verified_signature
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.dialects.postgresql import insert

# Routes called by our own services (not by browsers). Every request must carry a valid signature.
router = APIRouter(prefix="/internal", dependencies=[Depends(verified_signature)])


# Called by the frontend's Vercel Blob upload callback after a codebase zip has finished
# uploading. Idempotent: Vercel Blob may deliver the same callback more than once, so a repeat
# delivery for an existing codebase returns that codebase instead of failing.
@router.post("/codebases", status_code=201)
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
