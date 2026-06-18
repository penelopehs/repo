"""Pydantic schemas for the lead-centric API.

Shapes are aligned with the frontend's `Client` / `Engagement` / `FollowUpCall` /
`SavedCalculation` types so the SPA can consume them with minimal mapping.
"""

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models import PipelineStatus


# ── Users ──────────────────────────────────────────────────────────────────────

class User(BaseModel):
    iduser: int
    azure_ad_user_id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Clients ──────────────────────────────────────────────────────────────────

class Client(BaseModel):
    idclients: int
    client_name: str
    client_status_idclient_status: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ClientContactRow(BaseModel):
    """One row of the entity_people_roles join exposed by GET /clients, with all
    of the person's emails and phones (primary first)."""

    identity_people_roles: int
    entity_name: str
    first_name: str
    last_name: str
    role_name: str
    emails: List[str] = Field(default_factory=list)
    phones: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Referral channels ────────────────────────────────────────────────────────

class ReferralChannel(BaseModel):
    id: int
    channel_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Leads ──────────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    # Optional link to an existing entity_people_roles assignment
    # (entity ↔ person ↔ role); resolves the lead's entity & client.
    epr_id: Optional[int] = None
    # Contact info carried directly on the lead.
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    # The company / entity name — seeded into the calculations JSON as an entity.
    company: Optional[str] = None
    lead_source: Optional[str] = None
    # Initial pipeline stage; defaults to "New Lead" when omitted.
    pipeline_status: Optional[PipelineStatus] = None
    # The assigned sales rep (users.iduser); defaults to the calling user.
    assigned_sales_rep: Optional[int] = None
    # Optional assignments (users.iduser).
    sales_manager_iduser: Optional[int] = None
    training_manager_iduser: Optional[int] = None
    # Tax years — seeded as empty buckets under calculations.calculations
    # (e.g. [2022, 2023] -> {"2022": {}, "2023": {}}).
    tax_years: List[int] = Field(default_factory=list)
    notes: Optional[str] = None
    # Optional pre-built calculator state; when omitted it's seeded from
    # `company` + `tax_years` (see crm_leads.data).
    data: Optional[Any] = None


class LeadUpdate(BaseModel):
    # Link to an existing entity_people_roles assignment (entity ↔ person ↔
    # role); resolves the lead's entity & client. Pass null to unlink.
    epr_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    pipeline_status: Optional[PipelineStatus] = None
    lead_source: Optional[str] = None
    # The assigned sales rep (users.iduser).
    salesperson_iduser: Optional[int] = None
    # Optional assignments (users.iduser). Pass null to unassign.
    sales_manager_iduser: Optional[int] = None
    training_manager_iduser: Optional[int] = None
    notes: Optional[str] = None
    # Status-transition timestamps are normally stamped automatically when
    # pipeline_status advances; exposed here for manual correction.
    sow_signed_at: Optional[datetime] = None
    engagement_started_at: Optional[datetime] = None
    # Calculator state (crm_leads.data) — company/entities/tax-years live here.
    data: Optional[Any] = None


class LeadListItem(BaseModel):
    id: int
    company: Optional[str] = None
    full_name: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    pipeline_status: str
    lead_source: Optional[str] = None
    salesperson_iduser: Optional[int] = None
    salesperson_name: Optional[str] = None
    sales_manager_iduser: Optional[int] = None
    sales_manager_name: Optional[str] = None
    training_manager_iduser: Optional[int] = None
    training_manager_name: Optional[str] = None
    client_type: str  # "New" | "Returning"
    latest_calc_date: Optional[float] = None
    created_at: datetime
    sow_signed_at: Optional[datetime] = None
    engagement_started_at: Optional[datetime] = None
    entities_count: int
    tax_years: List[int] = Field(default_factory=list)
    data: Any = None
    notes: Optional[str] = None
    next_call: Optional[NextCallInfo] = None



# ── Nested reads for the detail aggregate ──────────────────────────────────────

class SubEntityRead(BaseModel):
    id: int
    name: str
    ein: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    entity_type: Optional[str] = None


class ContactRead(BaseModel):
    id: int
    name: str
    role: Optional[str] = None
    title: Optional[str] = None
    firm: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    entity_id: int


class EngagementRead(BaseModel):
    id: int
    type: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    tax_years: List[int] = Field(default_factory=list)


class NextCallInfo(BaseModel):
    date: date
    time: Optional[str] = None
    call_type: Optional[str] = None


class FollowUpCallRead(BaseModel):
    id: int
    scheduled_date: date
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    # Pipeline stage this call works; copied from the lead at creation.
    call_type: Optional[PipelineStatus] = None
    assigned_rep_name: Optional[str] = None
    completed: bool


class IntakeQuestionRead(BaseModel):
    id: int
    question: str
    answer: Optional[str] = None


class IntakeNoteRead(BaseModel):
    id: int
    note: str
    created_by_iduser: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LeadDetail(LeadListItem):
    notes: Optional[str] = None
    updated_at: Optional[datetime] = None
    engagements: List[EngagementRead] = Field(default_factory=list)
    follow_up_calls: List[FollowUpCallRead] = Field(default_factory=list)
    intake_questions: List[IntakeQuestionRead] = Field(default_factory=list)
    intake_notes: List[IntakeNoteRead] = Field(default_factory=list)
    # Free-form calculator state stored on the lead (crm_leads.data).


# ── Follow-up calls ────────────────────────────────────────────────────────────

class FollowUpCallCreate(BaseModel):
    scheduled_date: date
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    call_type: Optional[str] = None
    assigned_rep_name: Optional[str] = None


class FollowUpCallUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    call_type: Optional[str] = None
    assigned_rep_name: Optional[str] = None
    completed: Optional[bool] = None


# ── Intake notes ───────────────────────────────────────────────────────────────

class IntakeNoteCreate(BaseModel):
    note: str


class IntakeNoteUpdate(BaseModel):
    note: Optional[str] = None


# ── Engagements ──────────────────────────────────────────────────────────────

class EngagementCreate(BaseModel):
    type: str = "R&D Tax Credit"
    status: str = "Active"
    phase: Optional[str] = None


class EngagementUpdate(BaseModel):
    type: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None


# ── Calculations ───────────────────────────────────────────────────────────────
# Calculations are no longer a separate table: the whole calculator state is
# stored as a free-form JSON blob on crm_leads.data.

class CalculationsUpdate(BaseModel):
    data: Any


class CalculationSubmitBody(BaseModel):
    clientName: Optional[str] = None
    taxYears: Optional[List[Any]] = None
    federal: Optional[Any] = None
    tier: Optional[str] = None
    billing: Optional[Any] = None
    stateCredits: Optional[Any] = None
    notes: Optional[str] = None
    submittedAt: Optional[str] = None


# ── Feasibility calls ──────────────────────────────────────────────────────────

class FeasibilityEntityRead(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class FeasibilityEntityCreate(BaseModel):
    name: str
    entity_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    ein: Optional[str] = None


class FeasibilityCallCreate(BaseModel):
    call_setup: Any
    components: Any
    generated_output: Optional[Any] = None


class FeasibilityCallRead(BaseModel):
    id: int
    crm_leads_id: int
    call_setup: Any
    components: Any
    generated_output: Optional[Any] = None
    created_at: datetime
    updated_at: datetime
