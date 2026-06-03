"""Read-only clients API.

Exposes the entity ↔ person ↔ role assignments (the `entity_people_roles`
join) so the SPA can list who is attached to which entity and in what role.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import verify_token
from app.database import get_db

router = APIRouter(tags=["clients"], dependencies=[Depends(verify_token)])


@router.get("/clients", response_model=List[schemas.ClientContactRow])
def list_clients(
    db: Session = Depends(get_db),
    first_name: Optional[str] = Query(
        None,
        description="Case-insensitive substring match on people.first_name ('%q%').",
    ),
    last_name: Optional[str] = Query(
        None,
        description="Case-insensitive substring match on people.last_name ('%q%').",
    ),
    company: Optional[str] = Query(
        None,
        description="Case-insensitive substring match on entities.entity_name ('%q%').",
    ),
):
    # Mirrors the canonical query exactly:
    #   select epr.identity_people_roles, e.entity_name, p.first_name,
    #          p.last_name, pr.role_name, epr.created_at
    #   from entity_people_roles epr
    #   join entities e      on e.entity_id = epr.entities_entity_id
    #   join people p        on p.idperson  = epr.people_idperson
    #   join people_roles pr on pr.idroles  = epr.roles_idroles;
    q = (
        db.query(
            models.EntityPeopleRole.identity_people_roles,
            models.Entity.entity_name,
            models.Person.first_name,
            models.Person.last_name,
            models.PeopleRole.role_name,
            models.EntityPeopleRole.created_at,
        )
        .join(
            models.Entity,
            models.Entity.entity_id == models.EntityPeopleRole.entities_entity_id,
        )
        .join(
            models.Person,
            models.Person.idperson == models.EntityPeopleRole.people_idperson,
        )
        .join(
            models.PeopleRole,
            models.PeopleRole.idroles == models.EntityPeopleRole.roles_idroles,
        )
    )

    # Optional substring filters; each applied independently (combined with AND).
    if first_name and first_name.strip():
        q = q.filter(models.Person.first_name.ilike(f"%{first_name.strip()}%"))
    if last_name and last_name.strip():
        q = q.filter(models.Person.last_name.ilike(f"%{last_name.strip()}%"))
    if company and company.strip():
        q = q.filter(models.Entity.entity_name.ilike(f"%{company.strip()}%"))

    return q.all()
