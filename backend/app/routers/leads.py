"""Lead-centric CRM API.

A `clients` row is a permanent account; each pipeline run is a `crm_leads`
row carrying `pipeline_status`. The "New Leads" list is leads in a
pre-signature status. This router consolidates the pipeline, the client overview
aggregate, follow-up calls, engagements (+ yearly billing) and saved calculations
into a focused surface — no per-model CRUD.
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import verify_token
from app.database import get_db
from app.models import LEAD_STATUSES, PipelineStatus

router = APIRouter(tags=["leads"], dependencies=[Depends(verify_token)])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _caller(db: Session, claims: dict) -> models.User:
    """Resolve the authenticated user to a users row (same contract as the old
    leads.create flow). 403 if no profile exists yet."""
    oid = claims.get("oid")
    user = db.query(models.User).filter(models.User.azure_ad_user_id == oid).first()
    if not user:
        raise HTTPException(
            status_code=403,
            detail="User profile not found. Call GET /users/me first to provision it.",
        )
    return user


def _lead_entity(db: Session, lead: models.CrmLead) -> Optional[models.Entity]:
    """The entity a lead is attached to, via its EPR assignment
    (crm_leads.epr_id → entity_people_roles → entities)."""
    if not lead.epr_id:
        return None
    return (
        db.query(models.Entity)
        .join(
            models.EntityPeopleRole,
            models.EntityPeopleRole.entities_entity_id == models.Entity.entity_id,
        )
        .filter(models.EntityPeopleRole.identity_people_roles == lead.epr_id)
        .first()
    )


def _lead_client_id(db: Session, lead: models.CrmLead) -> Optional[int]:
    """The client account behind a lead: epr → entity → clients_idclients."""
    entity = _lead_entity(db, lead)
    return entity.clients_idclients if entity else None


def _get_or_create_engagement_type(db: Session, name: str) -> int:
    row = (
        db.query(models.EngagementTypeRef)
        .filter(models.EngagementTypeRef.engagement_type_name == name)
        .first()
    )
    if not row:
        row = models.EngagementTypeRef(engagement_type_name=name)
        db.add(row)
        db.flush()
    return row.idengagement_types


def _get_or_create_engagement_status(db: Session, name: str) -> int:
    row = (
        db.query(models.EngagementStatusRef)
        .filter(models.EngagementStatusRef.status_name == name)
        .first()
    )
    if not row:
        row = models.EngagementStatusRef(status_name=name)
        db.add(row)
        db.flush()
    return row.idengagement_status


def _get_lead(db: Session, lead_id: int) -> models.CrmLead:
    lead = (
        db.query(models.CrmLead)
        .filter(models.CrmLead.crm_lead_id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


def _lead_tax_years(data) -> List[int]:
    """The tax years present in the lead's data blob — the keys of
    data['calculations'] (e.g. {"2024": {}, "2025": {}}), as sorted ints."""
    years: List[int] = []
    if isinstance(data, dict):
        buckets = data.get("calculations")
        if isinstance(buckets, dict):
            for key in buckets:
                try:
                    years.append(int(key))
                except (TypeError, ValueError):
                    continue
    return sorted(years)


def _latest_calc_date(data) -> Optional[float]:
    """The newest calculation's `created_at` timestamp from the lead's data
    blob. `data['calculations']` holds calculation objects (a dict keyed by
    year, or a list); each carries a `created_at` epoch timestamp. Returns the
    max, or None when there are no timestamped calculations."""
    timestamps: List[float] = []
    if isinstance(data, dict):
        calcs = data.get("calculations")
        items = calcs.values() if isinstance(calcs, dict) else calcs
        if isinstance(items, (list, tuple)) or hasattr(items, "__iter__"):
            for calc in items:
                if isinstance(calc, dict):
                    ts = calc.get("created_at")
                    if isinstance(ts, (int, float)) and not isinstance(ts, bool):
                        timestamps.append(float(ts))
    return max(timestamps) if timestamps else None


def _entities_count(data) -> int:
    """Number of entities saved on the lead (len of `data['entities']`)."""
    if isinstance(data, dict):
        entities = data.get("entities")
        if isinstance(entities, list):
            return len(entities)
    return 0


def _initial_data(company: Optional[str], tax_years) -> dict:
    """Seed the lead's data JSON: one entity (the provided company / entity
    name), an empty bucket per tax year, and an empty people list."""
    return {
        "entities": [{"name": company}] if company else [],
        "calculations": {str(year): {} for year in (tax_years or [])},
        "people": [],
    }


def _client_type(db: Session, client_id: Optional[int]) -> str:
    if not client_id:
        return "New"
    # Count leads attached to this client across ALL statuses, walking
    # crm_leads → epr → entities → clients_idclients.
    count = (
        db.query(func.count(models.CrmLead.crm_lead_id))
        .select_from(models.CrmLead)
        .join(
            models.EntityPeopleRole,
            models.EntityPeopleRole.identity_people_roles == models.CrmLead.epr_id,
        )
        .join(
            models.Entity,
            models.Entity.entity_id == models.EntityPeopleRole.entities_entity_id,
        )
        .filter(models.Entity.clients_idclients == client_id)
        .scalar()
    )
    return "Returning" if (count or 0) > 1 else "New"


def _people_contact_info(db: Session, client_id: int):
    """Primary contact (company/email/phone) for a client, walking
    client → entities → entity_people_roles → people. Returns a
    (company, email, phone) tuple, or None when the client has no people.

    'company' is taken from the contact's firm; the primary email/phone win
    (is_primary, else first seen). The chosen contact is the lowest-id person
    that has an email, else the lowest-id person overall."""
    entity_ids = [
        e.entity_id
        for e in db.query(models.Entity)
        .filter(models.Entity.clients_idclients == client_id)
        .all()
    ]
    if not entity_ids:
        return None
    links = (
        db.query(models.EntityPeopleRole)
        .filter(models.EntityPeopleRole.entities_entity_id.in_(entity_ids))
        .all()
    )
    person_ids = {l.people_idperson for l in links}
    if not person_ids:
        return None
    people = {
        p.idperson: p
        for p in db.query(models.Person).filter(models.Person.idperson.in_(person_ids)).all()
    }
    if not people:
        return None
    emails = _primary_map(
        db.query(models.PeopleEmail)
        .filter(models.PeopleEmail.people_idperson.in_(person_ids))
        .all(),
        lambda r: r.people_idperson,
        lambda r: r.email,
    )
    phones = _primary_map(
        db.query(models.PeoplePhone)
        .filter(models.PeoplePhone.people_idperson.in_(person_ids))
        .all(),
        lambda r: r.people_idperson,
        lambda r: r.phone,
    )
    chosen = next((pid for pid in sorted(people) if pid in emails), min(people))
    p = people[chosen]
    return (p.firm, emails.get(chosen), phones.get(chosen))


def _company_for(db: Session, lead: models.CrmLead) -> Optional[str]:
    """The lead's company / entity name. It's seeded into the data JSON on
    create (entities[0].name); we fall back to the client's people firm. The
    lead's own contact (first_name/last_name/email/phone) lives directly on crm_leads."""
    data = lead.data
    if isinstance(data, dict):
        entities = data.get("entities")
        if isinstance(entities, list) and entities:
            first = entities[0]
            if isinstance(first, dict) and first.get("name"):
                return first["name"]
    client_id = _lead_client_id(db, lead)
    if client_id:
        info = _people_contact_info(db, client_id)
        if info and info[0]:
            return info[0]
    return None


# ── Pipeline list ────────────────────────────────────────────────────────────

@router.get("/leads", response_model=List[schemas.LeadListItem])
def list_leads(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(
        None,
        description="Comma-separated pipeline statuses, e.g. 'Lead,Calculation Sent' "
        "for the New Leads table.",
    ),
):
    q = db.query(models.CrmLead).order_by(models.CrmLead.created_at.desc())
    if status:
        wanted = [s.strip() for s in status.split(",") if s.strip()]
        q = q.filter(models.CrmLead.pipeline_status.in_(wanted))
    leads = q.all()

    # Resolve each lead's client through its EPR assignment (epr → entity → client).
    client_id_by_lead = {o.crm_lead_id: _lead_client_id(db, o) for o in leads}
    client_ids = {cid for cid in client_id_by_lead.values() if cid}
    # total lead count per client (across ALL statuses) -> New/Returning
    counts = dict(
        db.query(models.Entity.clients_idclients, func.count(models.CrmLead.crm_lead_id))
        .select_from(models.CrmLead)
        .join(
            models.EntityPeopleRole,
            models.EntityPeopleRole.identity_people_roles == models.CrmLead.epr_id,
        )
        .join(
            models.Entity,
            models.Entity.entity_id == models.EntityPeopleRole.entities_entity_id,
        )
        .filter(models.Entity.clients_idclients.in_(client_ids))
        .group_by(models.Entity.clients_idclients)
        .all()
    ) if client_ids else {}
    rep_ids = {o.salesperson_iduser for o in leads if o.salesperson_iduser}
    reps = {
        u.iduser: f"{u.first_name} {u.last_name}".strip()
        for u in db.query(models.User).filter(models.User.iduser.in_(rep_ids)).all()
    } if rep_ids else {}

    def _item(o: models.CrmLead) -> schemas.LeadListItem:
        client_id = client_id_by_lead.get(o.crm_lead_id)
        return schemas.LeadListItem(
            id=o.crm_lead_id,
            company=_company_for(db, o),
            full_name=f"{o.first_name} {o.last_name}".strip(),
            email=o.email,
            phone=o.phone,
            pipeline_status=o.pipeline_status,
            lead_source=o.lead_source,
            salesperson_iduser=o.salesperson_iduser,
            salesperson_name=reps.get(o.salesperson_iduser),
            client_type="Returning" if client_id and counts.get(client_id, 1) > 1 else "New",
            latest_calc_date=_latest_calc_date(o.data),
            created_at=o.created_at,
            sow_signed_at=o.sow_signed_at,
            engagement_started_at=o.engagement_started_at,
            entities_count=_entities_count(o.data),
            tax_years=_lead_tax_years(o.data),
            data=o.data,
        )

    return [_item(o) for o in leads]


# ── Create lead ────────────────────────────────────────────────────────────────

@router.post("/leads", response_model=schemas.LeadDetail, status_code=201)
def create_lead(
    body: schemas.LeadCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    caller = _caller(db, claims)

    # Optionally link to an existing entity_people_roles assignment.
    if body.epr_id is not None:
        epr = (
            db.query(models.EntityPeopleRole)
            .filter(models.EntityPeopleRole.identity_people_roles == body.epr_id)
            .first()
        )
        if not epr:
            raise HTTPException(
                status_code=404, detail="Entity-people-role assignment not found"
            )

    data = (
        body.data
        if body.data is not None
        else _initial_data(body.company, body.tax_years)
    )

    lead = models.CrmLead(
        epr_id=body.epr_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        pipeline_status=PipelineStatus.lead.value,
        lead_source=body.lead_source,
        salesperson_iduser=body.assigned_sales_rep or caller.iduser,
        notes=body.notes,
        data=data,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _build_detail(db, lead)


# ── Detail aggregate ────────────────────────────────────────────────────────────

@router.get("/leads/{lead_id}", response_model=schemas.LeadDetail)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    return _build_detail(db, _get_lead(db, lead_id))


def _build_detail(db: Session, lead: models.CrmLead) -> schemas.LeadDetail:
    client_id = _lead_client_id(db, lead)
    company = _company_for(db, lead)
    rep = (
        db.query(models.User).filter(models.User.iduser == lead.salesperson_iduser).first()
        if lead.salesperson_iduser
        else None
    )

    # engagements (+ tax years)
    engagements: List[schemas.EngagementRead] = []
    eng_rows = (
        db.query(models.Engagement)
        .filter(models.Engagement.crm_leads_id == lead.crm_lead_id)
        .all()
    )
    if eng_rows:
        eng_ids = [e.idengagements for e in eng_rows]
        type_map = {t.idengagement_types: t.engagement_type_name for t in db.query(models.EngagementTypeRef).all()}
        status_map = {s.idengagement_status: s.status_name for s in db.query(models.EngagementStatusRef).all()}
        tax_years = (
            db.query(models.EngagementTaxYear)
            .filter(models.EngagementTaxYear.engagements_idengagements.in_(eng_ids))
            .all()
        )
        for e in eng_rows:
            engagements.append(
                schemas.EngagementRead(
                    id=e.idengagements,
                    type=type_map.get(e.engagement_types_idengagement_types),
                    status=status_map.get(e.engagement_status_idengagement_status),
                    phase=e.phase,
                    start_date=e.start_date,
                    end_date=e.end_date,
                    tax_years=[
                        int(t.tax_year) for t in tax_years if t.engagements_idengagements == e.idengagements
                    ],
                )
            )

    follow_up_calls = [
        schemas.FollowUpCallRead(
            id=c.idcrm_follow_up_call,
            scheduled_date=c.scheduled_date,
            scheduled_time=c.scheduled_time,
            notes=c.notes,
            completed=bool(c.completed),
        )
        for c in db.query(models.CrmFollowUpCall)
        .filter(models.CrmFollowUpCall.crm_leads_id == lead.crm_lead_id)
        .order_by(models.CrmFollowUpCall.scheduled_date.desc())
        .all()
    ]

    intake_questions = [
        schemas.IntakeQuestionRead(id=q.idcrm_intake_question, question=q.question, answer=q.answer)
        for q in db.query(models.CrmIntakeQuestion)
        .filter(models.CrmIntakeQuestion.crm_leads_id == lead.crm_lead_id)
        .order_by(models.CrmIntakeQuestion.display_order.asc())
        .all()
    ]

    return schemas.LeadDetail(
        id=lead.crm_lead_id,
        company=company,
        full_name=f"{lead.first_name} {lead.last_name}".strip(),
        email=lead.email,
        phone=lead.phone,
        pipeline_status=lead.pipeline_status,
        lead_source=lead.lead_source,
        salesperson_iduser=lead.salesperson_iduser,
        salesperson_name=f"{rep.first_name} {rep.last_name}".strip() if rep else None,
        client_type=_client_type(db, client_id),
        latest_calc_date=_latest_calc_date(lead.data),
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        sow_signed_at=lead.sow_signed_at,
        engagement_started_at=lead.engagement_started_at,
        entities_count=_entities_count(lead.data),
        notes=lead.notes,
        engagements=engagements,
        follow_up_calls=follow_up_calls,
        intake_questions=intake_questions,
        data=lead.data,
        tax_years=_lead_tax_years(lead.data),
    )


def _primary_map(rows, key_fn, val_fn) -> dict:
    """Map person_id -> preferred value (is_primary wins, else first seen)."""
    out: dict = {}
    for r in rows:
        k = key_fn(r)
        if k not in out or getattr(r, "is_primary", False):
            out[k] = val_fn(r)
    return out


# ── Update (incl. status transitions) ──────────────────────────────────────────

@router.patch("/leads/{lead_id}", response_model=schemas.LeadDetail)
def update_lead(
    lead_id: int, body: schemas.LeadUpdate, db: Session = Depends(get_db)
):
    lead = _get_lead(db, lead_id)
    data = body.model_dump(exclude_unset=True)

    new_status = data.get("pipeline_status")
    if isinstance(new_status, PipelineStatus):
        new_status = new_status.value
        data["pipeline_status"] = new_status
    if new_status == PipelineStatus.sow_signed.value and lead.sow_signed_at is None:
        lead.sow_signed_at = datetime.utcnow()
    if new_status == PipelineStatus.active_engagement.value and lead.engagement_started_at is None:
        lead.engagement_started_at = datetime.utcnow()

    for field, value in data.items():
        setattr(lead, field, value)

    db.commit()
    db.refresh(lead)
    return _build_detail(db, lead)


@router.delete("/leads/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = _get_lead(db, lead_id)
    # Children (intake questions / follow-up calls) cascade via FK.
    # The clients account is intentionally NOT deleted.
    db.delete(lead)
    db.commit()


# ── Follow-up calls ────────────────────────────────────────────────────────────

@router.post(
    "/leads/{lead_id}/follow-up-calls",
    response_model=schemas.FollowUpCallRead,
    status_code=201,
)
def create_follow_up_call(
    lead_id: int, body: schemas.FollowUpCallCreate, db: Session = Depends(get_db)
):
    _get_lead(db, lead_id)
    call = models.CrmFollowUpCall(
        crm_leads_id=lead_id,
        scheduled_date=body.scheduled_date,
        scheduled_time=body.scheduled_time,
        notes=body.notes,
        completed=False,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return _call_read(call)


@router.get(
    "/leads/{lead_id}/follow-up-calls",
    response_model=List[schemas.FollowUpCallRead],
)
def list_follow_up_calls(lead_id: int, db: Session = Depends(get_db)):
    _get_lead(db, lead_id)
    calls = (
        db.query(models.CrmFollowUpCall)
        .filter(models.CrmFollowUpCall.crm_leads_id == lead_id)
        .order_by(models.CrmFollowUpCall.scheduled_date.desc())
        .all()
    )
    return [_call_read(c) for c in calls]


@router.patch(
    "/leads/{lead_id}/follow-up-calls/{call_id}",
    response_model=schemas.FollowUpCallRead,
)
def update_follow_up_call(
    lead_id: int,
    call_id: int,
    body: schemas.FollowUpCallUpdate,
    db: Session = Depends(get_db),
):
    call = _get_lead_call(db, lead_id, call_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(call, field, value)
    db.commit()
    db.refresh(call)
    return _call_read(call)


def _get_lead_call(db: Session, lead_id: int, call_id: int) -> models.CrmFollowUpCall:
    """A follow-up call that belongs to `lead_id`. 404 if it doesn't exist or
    is attached to a different lead."""
    call = (
        db.query(models.CrmFollowUpCall)
        .filter(
            models.CrmFollowUpCall.idcrm_follow_up_call == call_id,
            models.CrmFollowUpCall.crm_leads_id == lead_id,
        )
        .first()
    )
    if not call:
        raise HTTPException(status_code=404, detail="Follow-up call not found")
    return call


def _call_read(call: models.CrmFollowUpCall) -> schemas.FollowUpCallRead:
    return schemas.FollowUpCallRead(
        id=call.idcrm_follow_up_call,
        scheduled_date=call.scheduled_date,
        scheduled_time=call.scheduled_time,
        notes=call.notes,
        completed=bool(call.completed),
    )


# ── Engagements ──────────────────────────────────────────────────────────────

@router.post("/leads/{lead_id}/engagements", response_model=schemas.EngagementRead, status_code=201)
def create_engagement(
    lead_id: int,
    body: schemas.EngagementCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    lead = _get_lead(db, lead_id)
    caller = _caller(db, claims)

    # Resolve the (NOT NULL) entity from the lead's EPR assignment.
    ent = _lead_entity(db, lead)
    if not ent:
        raise HTTPException(
            status_code=400,
            detail="Cannot create an engagement: the lead has no entity yet.",
        )
    entity_id = ent.entity_id

    eng = models.Engagement(
        entities_entity_id=entity_id,
        assigned_user_id=caller.iduser,
        engagement_types_idengagement_types=_get_or_create_engagement_type(db, body.type),
        engagement_status_idengagement_status=_get_or_create_engagement_status(db, body.status),
        start_date=date.today(),
        end_date=None,
        created_by=caller.iduser,
        phase=body.phase,
        crm_leads_id=lead_id,
    )
    db.add(eng)
    db.commit()
    db.refresh(eng)
    return _engagement_read(db, eng)


@router.patch("/engagements/{eng_id}", response_model=schemas.EngagementRead)
def update_engagement(
    eng_id: int, body: schemas.EngagementUpdate, db: Session = Depends(get_db)
):
    eng = db.query(models.Engagement).filter(models.Engagement.idengagements == eng_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if body.type is not None:
        eng.engagement_types_idengagement_types = _get_or_create_engagement_type(db, body.type)
    if body.status is not None:
        eng.engagement_status_idengagement_status = _get_or_create_engagement_status(db, body.status)
    if body.phase is not None:
        eng.phase = body.phase

    db.commit()
    db.refresh(eng)
    return _engagement_read(db, eng)


def _engagement_read(db: Session, eng: models.Engagement) -> schemas.EngagementRead:
    type_name = (
        db.query(models.EngagementTypeRef.engagement_type_name)
        .filter(models.EngagementTypeRef.idengagement_types == eng.engagement_types_idengagement_types)
        .scalar()
    )
    status_name = (
        db.query(models.EngagementStatusRef.status_name)
        .filter(models.EngagementStatusRef.idengagement_status == eng.engagement_status_idengagement_status)
        .scalar()
    )
    tax_years = (
        db.query(models.EngagementTaxYear)
        .filter(models.EngagementTaxYear.engagements_idengagements == eng.idengagements)
        .all()
    )
    return schemas.EngagementRead(
        id=eng.idengagements,
        type=type_name,
        status=status_name,
        phase=eng.phase,
        start_date=eng.start_date,
        end_date=eng.end_date,
        tax_years=[int(t.tax_year) for t in tax_years],
    )


# ── Calculations ───────────────────────────────────────────────────────────────
# The calculator state is a free-form JSON blob stored on crm_leads.data.

@router.put("/leads/{lead_id}/calculations", response_model=schemas.LeadDetail)
def save_calculations(
    lead_id: int, body: schemas.CalculationsUpdate, db: Session = Depends(get_db)
):
    lead = _get_lead(db, lead_id)
    lead.data = body.data
    # Mirror the old saveCalculation behaviour: a fresh Lead becomes Calculation Sent.
    if lead.pipeline_status == PipelineStatus.lead.value:
        lead.pipeline_status = PipelineStatus.calculation_sent.value
    db.commit()
    db.refresh(lead)
    return _build_detail(db, lead)


@router.delete("/leads/{lead_id}/calculations", status_code=204)
def clear_calculations(lead_id: int, db: Session = Depends(get_db)):
    lead = _get_lead(db, lead_id)
    lead.data = []
    db.commit()
