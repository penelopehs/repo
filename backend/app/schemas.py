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


# ── Referral channels ────────────────────────────────────────────────────────

class ReferralChannel(BaseModel):
    id: int
    channel_name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Leads ──────────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    # Either attach to an existing client...
    client_id: Optional[int] = None
    # ...or create a new client (client_name required when client_id is absent).
    client_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    # Lead fields.
    title: Optional[str] = None
    research_type: Optional[str] = None
    lead_source: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    title: Optional[str] = None
    research_type: Optional[str] = None
    pipeline_status: Optional[PipelineStatus] = None
    lead_source: Optional[str] = None
    notes: Optional[str] = None
    # account-level contact info (crm_lead_profile)
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class LeadListItem(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: str
    company: Optional[str] = None
    title: Optional[str] = None
    research_type: Optional[str] = None
    pipeline_status: str
    lead_source: Optional[str] = None
    salesperson_iduser: Optional[int] = None
    salesperson_name: Optional[str] = None
    client_type: str  # "New" | "Returning"
    latest_calc_total: Optional[float] = None
    created_at: datetime
    sow_signed_at: Optional[datetime] = None
    engagement_started_at: Optional[datetime] = None


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


class YearlyBilling(BaseModel):
    year: int
    billing_amount: float


class EngagementRead(BaseModel):
    id: int
    type: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    yearly_billing: List[YearlyBilling] = Field(default_factory=list)
    tax_years: List[int] = Field(default_factory=list)


class FollowUpCallRead(BaseModel):
    id: int
    scheduled_date: date
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    completed: bool


class IntakeQuestionRead(BaseModel):
    id: int
    question: str
    answer: Optional[str] = None


class CalculationSummary(BaseModel):
    id: int
    tax_year: int
    tax_filing_status: Optional[str] = None
    total_bill: Optional[float] = None
    entity_count: int
    created_at: datetime


class LeadDetail(LeadListItem):
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    updated_at: Optional[datetime] = None
    sub_entities: List[SubEntityRead] = Field(default_factory=list)
    contacts: List[ContactRead] = Field(default_factory=list)
    engagements: List[EngagementRead] = Field(default_factory=list)
    follow_up_calls: List[FollowUpCallRead] = Field(default_factory=list)
    intake_questions: List[IntakeQuestionRead] = Field(default_factory=list)
    calculations: List[CalculationSummary] = Field(default_factory=list)


# ── Follow-up calls ────────────────────────────────────────────────────────────

class FollowUpCallCreate(BaseModel):
    scheduled_date: date
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None


class FollowUpCallUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None


# ── Engagements ──────────────────────────────────────────────────────────────

class EngagementCreate(BaseModel):
    type: str = "R&D Tax Credit"
    status: str = "Active"
    phase: Optional[str] = None
    yearly_billing: List[YearlyBilling] = Field(default_factory=list)


class EngagementUpdate(BaseModel):
    type: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    yearly_billing: Optional[List[YearlyBilling]] = None


# ── Calculations ───────────────────────────────────────────────────────────────

class CalculationEntityIn(BaseModel):
    entity_name: str
    entities_entity_id: Optional[int] = None
    state: Optional[str] = None
    tax_filing_status: Optional[str] = None
    employee_count: Optional[int] = None
    estimate_qras: Optional[int] = None
    gross_credit: Optional[float] = None
    w2_wages: Optional[float] = None
    contract_research: Optional[float] = None
    supplies: Optional[float] = None
    other_expenses: Optional[float] = None
    manager_reviewed: bool = False
    notes: Optional[str] = None
    tier: Optional[str] = None
    total_bill: Optional[float] = None
    grand_total: Optional[float] = None
    result_json: Optional[Any] = None


class CalculationCreate(BaseModel):
    tax_year: int
    tax_filing_status: Optional[str] = None
    notes: Optional[str] = None
    entities: List[CalculationEntityIn] = Field(default_factory=list)


class CalculationRead(CalculationSummary):
    pass
