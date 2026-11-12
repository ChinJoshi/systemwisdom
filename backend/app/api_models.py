from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ActClaim(BaseModel):
    sub: str  # Email address of the impersonating WorkOS Dashboard user


class AccessTokenJWT(BaseModel):
    iss: str  # Issuer
    sub: str  # Unique ID of the user
    act: Optional[ActClaim] = None  # RFC 8693 impersonation claim

    # This app has no organizations, so org-scoped claims are optional and unused.
    org_id: Optional[str] = None
    role: Optional[str] = None
    roles: Optional[List[str]] = None
    permissions: Optional[List[str]] = None
    entitlements: Optional[List[str]] = None

    sid: str  # Session ID
    jti: str  # Token ID

    exp: datetime  # Expiration (epoch seconds)
    iat: datetime  # Issued-at (epoch seconds)


class AuthenticatedUser(BaseModel):
    user_id: str
    session_id: str


class MeResponse(BaseModel):
    user_id: str
