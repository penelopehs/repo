"""Read-only clients API.

Exposes the permanent `clients` accounts for lookups (e.g. attaching a new lead
to an existing client). Search is a case-insensitive substring match on
`client_name` (`LIKE '%<name>%'`).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import verify_token
from app.database import get_db

router = APIRouter(tags=["clients"], dependencies=[Depends(verify_token)])


@router.get("/clients", response_model=List[schemas.Client])
def list_clients(
    db: Session = Depends(get_db),
    name: Optional[str] = Query(
        None,
        description="Case-insensitive substring match on client_name "
        "(matched as '%<name>%'). Omit to return all clients.",
    ),
):
    q = db.query(models.Client)
    if name and name.strip():
        q = q.filter(models.Client.client_name.ilike(f"%{name.strip()}%"))
    return q.order_by(models.Client.client_name.asc()).all()
