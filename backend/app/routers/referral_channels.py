"""Read-only referral channels lookup API.

Backs the lead `lead_source` dropdown (extra_db.md §3) — the canonical list of
referral channel names from the `referral_channels` reference table.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import verify_token
from app.database import get_db

router = APIRouter(tags=["referral-channels"], dependencies=[Depends(verify_token)])


@router.get("/referral-channels", response_model=List[schemas.ReferralChannel])
def list_referral_channels(db: Session = Depends(get_db)):
    return (
        db.query(models.ReferralChannel)
        .order_by(models.ReferralChannel.channel_name.asc())
        .all()
    )
