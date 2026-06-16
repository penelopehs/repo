from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth import verify_token
from app.database import get_db

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(verify_token)])


@router.get("/me", response_model=schemas.User)
def get_or_create_me(
    claims: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    oid = claims.get("oid")
    if not oid:
        raise HTTPException(status_code=400, detail="Token missing 'oid' claim.")

    user = db.query(models.User).filter(models.User.azure_ad_user_id == oid).first()
    if user:
        return user

    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn", "")
    given_name = claims.get("given_name", "")
    family_name = claims.get("family_name", "")
    if not given_name or not family_name:
        parts = (claims.get("name") or "").split()
        given_name = given_name or (parts[0] if parts else "Unknown")
        family_name = family_name or (parts[-1] if len(parts) > 1 else given_name)

    user = models.User(
        azure_ad_user_id=oid,
        email=email,
        first_name=given_name,
        last_name=family_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[schemas.User])
def list_users(db: Session = Depends(get_db)):
    """Used by the frontend to populate the salesperson dropdown."""
    return db.query(models.User).all()
