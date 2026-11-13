import hashlib
import hmac
import logging
from typing import Annotated

import jwt
from app.api_models import AccessTokenJWT, AuthenticatedUser
from app.config import settings
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import ValidationError
from workos import WorkOSClient

SIGNATURE_HEADER = "X-Signature"


logger = logging.getLogger(__name__)


workos_client = WorkOSClient(
    api_key=settings.workos_api_key.get_secret_value(),
    client_id=settings.workos_client_id,
)


bearer_security = HTTPBearer()


jwks_url = workos_client.user_management.get_jwks_url()
# Shared across requests so the fetched signing keys are cached between calls.
jwks_client = PyJWKClient(jwks_url)


# Verifies the WorkOS access token sent by the frontend and returns the user it belongs to.
def authenticated_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_security)],
) -> AuthenticatedUser:
    try:
        token = credentials.credentials
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        verified_token = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
        )
        access_token = AccessTokenJWT.model_validate(verified_token)
        return AuthenticatedUser(
            user_id=access_token.sub,
            session_id=access_token.sid,
        )
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError as e:
        logger.warning("Invalid token: %s", str(e))
        raise HTTPException(status_code=401, detail="Invalid token")
    except ValidationError as e:
        logger.warning("Access token object failed validation: %s", e)
        raise HTTPException(status_code=401, detail="Invalid access token")


# Guards endpoints that are only called server-to-server (e.g. by the frontend's Vercel Blob upload
# callback, which runs without a user session). The caller signs the raw request body with
# HMAC-SHA256 using the shared HMAC_SECRET and sends the hex digest in the X-Signature header.
async def verified_signature(request: Request) -> None:
    signature = request.headers.get(SIGNATURE_HEADER, "")
    expected = hmac.new(
        settings.hmac_secret.get_secret_value().encode(),
        await request.body(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        logger.warning("Rejected request with a missing or invalid HMAC signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
