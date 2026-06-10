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
from app.models import PipelineStatus

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
        description="Comma-separated pipeline statuses, e.g. 'New Lead,Intro Call' "
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
    # iduser -> name for every user referenced by a lead (rep + managers).
    names = _user_name_map(
        db,
        [
            uid
            for o in leads
            for uid in (o.salesperson_iduser, o.sales_manager_iduser, o.training_manager_iduser)
        ],
    )

    def _item(o: models.CrmLead) -> schemas.LeadListItem:
        client_id = client_id_by_lead.get(o.crm_lead_id)
        return schemas.LeadListItem(
            id=o.crm_lead_id,
            company=_company_for(db, o),
            full_name=f"{o.first_name} {o.last_name}".strip(),
            first_name=o.first_name,
            last_name=o.last_name,
            email=o.email,
            phone=o.phone,
            pipeline_status=o.pipeline_status,
            lead_source=o.lead_source,
            salesperson_iduser=o.salesperson_iduser,
            salesperson_name=names.get(o.salesperson_iduser),
            sales_manager_iduser=o.sales_manager_iduser,
            sales_manager_name=names.get(o.sales_manager_iduser),
            training_manager_iduser=o.training_manager_iduser,
            training_manager_name=names.get(o.training_manager_iduser),
            client_type="Returning" if client_id and counts.get(client_id, 1) > 1 else "New",
            latest_calc_date=_latest_calc_date(o.data),
            created_at=o.created_at,
            sow_signed_at=o.sow_signed_at,
            engagement_started_at=o.engagement_started_at,
            entities_count=_entities_count(o.data),
            tax_years=_lead_tax_years(o.data),
            data=o.data,
            notes=o.notes,
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
        pipeline_status=PipelineStatus.new_lead.value,
        lead_source=body.lead_source,
        salesperson_iduser=body.assigned_sales_rep or caller.iduser,
        sales_manager_iduser=body.sales_manager_iduser,
        training_manager_iduser=body.training_manager_iduser,
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
    names = _user_name_map(
        db,
        [lead.salesperson_iduser, lead.sales_manager_iduser, lead.training_manager_iduser],
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
            call_type=c.call_type,
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

    note_rows = (
        db.query(models.CrmIntakeNote)
        .filter(models.CrmIntakeNote.crm_leads_id == lead.crm_lead_id)
        .order_by(
            models.CrmIntakeNote.created_at.desc(),
            models.CrmIntakeNote.idcrm_intake_note.desc(),
        )
        .all()
    )
    author_names = _user_name_map(db, [n.created_by_iduser for n in note_rows])
    intake_notes = [_note_read(n, author_names) for n in note_rows]

    return schemas.LeadDetail(
        id=lead.crm_lead_id,
        company=company,
        full_name=f"{lead.first_name} {lead.last_name}".strip(),
        first_name=lead.first_name,
        last_name=lead.last_name,
        email=lead.email,
        phone=lead.phone,
        pipeline_status=lead.pipeline_status,
        lead_source=lead.lead_source,
        salesperson_iduser=lead.salesperson_iduser,
        salesperson_name=names.get(lead.salesperson_iduser),
        sales_manager_iduser=lead.sales_manager_iduser,
        sales_manager_name=names.get(lead.sales_manager_iduser),
        training_manager_iduser=lead.training_manager_iduser,
        training_manager_name=names.get(lead.training_manager_iduser),
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
        intake_notes=intake_notes,
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

    # Validate a re-linked EPR assignment (matches create); null unlinks.
    if data.get("epr_id") is not None:
        epr = (
            db.query(models.EntityPeopleRole)
            .filter(models.EntityPeopleRole.identity_people_roles == data["epr_id"])
            .first()
        )
        if not epr:
            raise HTTPException(
                status_code=404, detail="Entity-people-role assignment not found"
            )

    new_status = data.get("pipeline_status")
    if isinstance(new_status, PipelineStatus):
        new_status = new_status.value
        data["pipeline_status"] = new_status
    # Closing a lead (terminal "won" stage) starts the engagement clock.
    if new_status == PipelineStatus.closed.value and lead.engagement_started_at is None:
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
    lead = _get_lead(db, lead_id)
    # The call's type is the lead's current pipeline stage. A brand-new lead has
    # no stage yet, so scheduling its first call advances it into "Intro Call".
    if lead.pipeline_status == PipelineStatus.new_lead.value:
        lead.pipeline_status = PipelineStatus.intro_call.value
        call_type = PipelineStatus.intro_call.value
    else:
        call_type = lead.pipeline_status
    call = models.CrmFollowUpCall(
        crm_leads_id=lead_id,
        scheduled_date=body.scheduled_date,
        scheduled_time=body.scheduled_time,
        notes=body.notes,
        call_type=call_type,
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
    data = body.model_dump(exclude_unset=True)
    was_completed = bool(call.completed)
    for field, value in data.items():
        setattr(call, field, value)
    # Finishing a call advances the lead one pipeline stage (capped at Closed).
    if data.get("completed") and not was_completed:
        lead = _get_lead(db, lead_id)
        lead.pipeline_status = models.next_pipeline_status(lead.pipeline_status)
        # Reaching the terminal "Closed" stage starts the engagement clock,
        # mirroring update_lead.
        if (
            lead.pipeline_status == PipelineStatus.closed.value
            and lead.engagement_started_at is None
        ):
            lead.engagement_started_at = datetime.utcnow()
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
        call_type=call.call_type,
        completed=bool(call.completed),
    )


# ── Intake notes ───────────────────────────────────────────────────────────────
# A lead can carry many free-form intake notes (one-to-many).

@router.post(
    "/leads/{lead_id}/intake-notes",
    response_model=schemas.IntakeNoteRead,
    status_code=201,
)
def create_intake_note(
    lead_id: int,
    body: schemas.IntakeNoteCreate,
    db: Session = Depends(get_db),
    claims: dict = Depends(verify_token),
):
    _get_lead(db, lead_id)
    caller = _caller(db, claims)
    note = models.CrmIntakeNote(
        crm_leads_id=lead_id,
        note=body.note,
        created_by_iduser=caller.iduser,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_read(note, _user_name_map(db, [note.created_by_iduser]))


@router.get(
    "/leads/{lead_id}/intake-notes",
    response_model=List[schemas.IntakeNoteRead],
)
def list_intake_notes(lead_id: int, db: Session = Depends(get_db)):
    _get_lead(db, lead_id)
    notes = (
        db.query(models.CrmIntakeNote)
        .filter(models.CrmIntakeNote.crm_leads_id == lead_id)
        .order_by(
            models.CrmIntakeNote.created_at.desc(),
            models.CrmIntakeNote.idcrm_intake_note.desc(),
        )
        .all()
    )
    names = _user_name_map(db, [n.created_by_iduser for n in notes])
    return [_note_read(n, names) for n in notes]


@router.patch(
    "/leads/{lead_id}/intake-notes/{note_id}",
    response_model=schemas.IntakeNoteRead,
)
def update_intake_note(
    lead_id: int,
    note_id: int,
    body: schemas.IntakeNoteUpdate,
    db: Session = Depends(get_db),
):
    note = _get_lead_note(db, lead_id, note_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return _note_read(note, _user_name_map(db, [note.created_by_iduser]))


@router.delete(
    "/leads/{lead_id}/intake-notes/{note_id}", status_code=204
)
def delete_intake_note(lead_id: int, note_id: int, db: Session = Depends(get_db)):
    note = _get_lead_note(db, lead_id, note_id)
    db.delete(note)
    db.commit()


def _get_lead_note(db: Session, lead_id: int, note_id: int) -> models.CrmIntakeNote:
    """An intake note that belongs to `lead_id`. 404 if it doesn't exist or is
    attached to a different lead."""
    note = (
        db.query(models.CrmIntakeNote)
        .filter(
            models.CrmIntakeNote.idcrm_intake_note == note_id,
            models.CrmIntakeNote.crm_leads_id == lead_id,
        )
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Intake note not found")
    return note


def _user_name_map(db: Session, user_ids) -> dict:
    """Map iduser -> "First Last" for the given (possibly None/duplicated) ids."""
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    return {
        u.iduser: f"{u.first_name} {u.last_name}".strip()
        for u in db.query(models.User).filter(models.User.iduser.in_(ids)).all()
    }


def _note_read(note: models.CrmIntakeNote, names: dict) -> schemas.IntakeNoteRead:
    return schemas.IntakeNoteRead(
        id=note.idcrm_intake_note,
        note=note.note,
        created_by_iduser=note.created_by_iduser,
        created_by_name=names.get(note.created_by_iduser),
        created_at=note.created_at,
        updated_at=note.updated_at,
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
    # Saving a calculation advances a brand-new lead into the Intro Call stage.
    if lead.pipeline_status == PipelineStatus.new_lead.value:
        lead.pipeline_status = PipelineStatus.intro_call.value
    db.commit()
    db.refresh(lead)
    return _build_detail(db, lead)


@router.delete("/leads/{lead_id}/calculations", status_code=204)
def clear_calculations(lead_id: int, db: Session = Depends(get_db)):
    lead = _get_lead(db, lead_id)
    lead.data = []
    db.commit()
