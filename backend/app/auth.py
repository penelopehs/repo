from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str
    jwt_audience: str
    cors_origins: list[str] = ["*"]
    # SharePoint site to test, e.g. hostname "contoso.sharepoint.com" and
    # server-relative path "/sites/MasterClientDirectory".

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()  # type: ignore[call-arg]

OPENID_CONFIG_URL = (
    f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0/.well-known/openid-configuration"
)
VALID_ISSUERS = [
    f"https://login.microsoftonline.com/{settings.azure_tenant_id}/v2.0",
    f"https://sts.windows.net/{settings.azure_tenant_id}/",
]
VALID_AUDIENCES = [settings.jwt_audience, settings.azure_client_id]


@lru_cache
def _jwks_uri() -> str:
    meta = httpx.get(OPENID_CONFIG_URL, timeout=10).json()
    return meta["jwks_uri"]


@lru_cache
def _get_jwks() -> dict:
    return httpx.get(_jwks_uri(), timeout=10).json()


def _signing_key_for(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    for key in _get_jwks()["keys"]:
        if key["kid"] == kid:
            return key
    _get_jwks.cache_clear()
    for key in _get_jwks()["keys"]:
        if key["kid"] == kid:
            return key
    raise HTTPException(status_code=401, detail="Signing key not found for token.")


bearer_scheme = HTTPBearer(auto_error=True)


def get_raw_token(
    creds: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    """Return the raw bearer JWT string, e.g. to use as an On-Behalf-Of assertion."""
    return creds.credentials


def verify_token(
    creds: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    token = creds.credentials
    try:
        key = _signing_key_for(token)
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    if claims.get("iss") not in VALID_ISSUERS:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid issuer: {claims.get('iss')}. Expected one of {VALID_ISSUERS}.",
        )
    if claims.get("aud") not in VALID_AUDIENCES:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid audience: {claims.get('aud')}. Expected one of {VALID_AUDIENCES}.",
        )

    return claims


def get_roles(claims: dict) -> list[str]:
    return claims.get("roles", []) or []


def require_role(*allowed: str):
    def checker(claims: dict = Depends(verify_token)) -> dict:
        user_roles = get_roles(claims)
        if not any(r in user_roles for r in allowed):
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of roles: {', '.join(allowed)}. "
                f"You have: {', '.join(user_roles) or 'none'}.",
            )
        return claims

    return checker
