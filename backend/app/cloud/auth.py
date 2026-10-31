import hashlib
import hmac
import os
from functools import lru_cache
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import get_session
from .models import Device
from sqlalchemy import select

bearer = HTTPBearer(auto_error=False)

def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()

@lru_cache
def certificate_request():
    import requests
    import cachecontrol
    from google.auth.transport.requests import Request
    delegate = Request(session=cachecontrol.CacheControl(requests.Session()))
    def bounded_request(*args, **kwargs):
        kwargs["timeout"] = 10
        return delegate(*args, **kwargs)
    return bounded_request

def verify_firebase(token: str):
    # Google's public Firebase verifier needs no service-account/admin credential.
    # It verifies signatures against Google's HTTPS certificates, audience, iat/exp.
    import time
    import jwt
    from google.oauth2.id_token import verify_firebase_token
    project = os.getenv("FIREBASE_PROJECT_ID", "")
    if not project:
        raise ValueError("Firebase project is not configured")
    header = jwt.get_unverified_header(token)
    if header.get("alg") != "RS256" or not header.get("kid"):
        raise ValueError("Unsupported token")
    claims = verify_firebase_token(token, certificate_request(), audience=project)
    uid = claims.get("sub")
    if claims.get("iss") != "https://securetoken.google.com/" + project:
        raise ValueError("Wrong token issuer")
    if not isinstance(uid, str) or not 0 < len(uid) <= 128:
        raise ValueError("Invalid subject")
    if not isinstance(claims.get("auth_time"), (int, float)) or claims["auth_time"] > time.time():
        raise ValueError("Invalid authentication time")
    return uid

def user_uid(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, "Sign in to continue.")
    try:
        return verify_firebase(credentials.credentials)
    except Exception:
        raise HTTPException(401, "Sign in again to continue.") from None

def device_auth(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                session=Depends(get_session)):
    if not credentials:
        raise HTTPException(401, "Device authentication required.")
    parts = credentials.credentials.split(".", 1)
    device = session.scalar(select(Device).where(Device.id == parts[0]).with_for_update()) if len(parts) == 2 else None
    if not device or device.revoked or not hmac.compare_digest(device.credential_hash, digest(parts[1])):
        raise HTTPException(401, "Device authentication failed.")
    return device
