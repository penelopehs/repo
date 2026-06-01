"""SQLAlchemy models mapped onto the existing `sales_billing` MySQL schema
(acquirewc_dev_schema.sql) plus the CRM extension (extra_db.md).

Three kinds of models live here:

* **base** – tables that already exist in MySQL and are managed outside the app
  (provisioned from the .sql files). We map only the columns the app reads/writes.
  These are excluded from Alembic autogenerate (see alembic/env.py).
* **extended** – existing base tables (`people`, `engagements`) to which the CRM
  extension adds a few columns. Only the *new* columns are managed by Alembic.
* **crm_*** – brand-new extension tables, fully created by Alembic.
"""

import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.mysql import YEAR
from sqlalchemy.sql import func

from app.database import Base


class PipelineStatus(str, enum.Enum):
    """Sales-pipeline status carried by a crm_lead (extra_db.md)."""

    lead = "Lead"
    calculation_sent = "Calculation Sent"
    sow_signed = "SOW Signed"
    active_engagement = "Active Engagement"


PIPELINE_ENUM = Enum(
    *[s.value for s in PipelineStatus],
    name="crm_leads_pipeline_status",
    values_callable=lambda x: [e.value for e in x],
)

# Statuses that keep a lead in the "New Leads" list (pre-signature).
LEAD_STATUSES = (PipelineStatus.lead.value, PipelineStatus.calculation_sent.value)

_CREATED = text("CURRENT_TIMESTAMP")
_UPDATED = text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")


# ── Base tables (already in MySQL — excluded from Alembic autogenerate) ────────

class User(Base):
    __tablename__ = "users"

    iduser = Column(Integer, primary_key=True, autoincrement=True)
    azure_ad_user_id = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(45), nullable=False)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class Client(Base):
    __tablename__ = "clients"

    idclients = Column(Integer, primary_key=True, autoincrement=True)
    client_name = Column(String(255), nullable=False)
    client_status_idclient_status = Column(Integer, nullable=False)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())


class ClientStatusRef(Base):
    __tablename__ = "client_status"

    idclient_status = Column(Integer, primary_key=True, autoincrement=True)
    status_name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)


class ReferralChannel(Base):
    __tablename__ = "referral_channels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel_name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class Entity(Base):
    __tablename__ = "entities"

    entity_id = Column(Integer, primary_key=True, autoincrement=True)
    clients_idclients = Column(Integer, nullable=False)
    entity_name = Column(String(255), nullable=False)
    dba = Column(String(255), nullable=True)
    state = Column(String(2), nullable=True)
    city = Column(String(100), nullable=True)
    zip_code = Column(String(10), nullable=True)
    ein = Column(String(15), nullable=True)
    entity_types_id = Column(Integer, nullable=True)


class EntityTypeRef(Base):
    __tablename__ = "entity_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type_name = Column(String(50), nullable=False)


class Person(Base):
    """Extended: `title` and `firm` are new columns added by the CRM extension."""

    __tablename__ = "people"

    idperson = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    # ── new columns (managed by Alembic) ──
    title = Column(String(150), nullable=True)
    firm = Column(String(255), nullable=True)


class PeopleEmail(Base):
    __tablename__ = "people_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    people_idperson = Column(Integer, nullable=False)
    email = Column(String(255), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False)


class PeoplePhone(Base):
    __tablename__ = "people_phones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    people_idperson = Column(Integer, nullable=False)
    phone = Column(String(50), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False)


class PeopleRole(Base):
    __tablename__ = "people_roles"

    idroles = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(100), nullable=False)


class EntityPeopleRole(Base):
    __tablename__ = "entity_people_roles"

    identity_people_roles = Column(Integer, primary_key=True, autoincrement=True)
    entities_entity_id = Column(Integer, nullable=False)
    people_idperson = Column(Integer, nullable=False)
    roles_idroles = Column(Integer, nullable=False)


class EngagementTypeRef(Base):
    __tablename__ = "engagement_types"

    idengagement_types = Column(Integer, primary_key=True, autoincrement=True)
    engagement_type_name = Column(String(100), nullable=False)


class EngagementStatusRef(Base):
    __tablename__ = "engagement_status"

    idengagement_status = Column(Integer, primary_key=True, autoincrement=True)
    status_name = Column(String(45), nullable=False)


class Engagement(Base):
    """Extended: `phase` and `crm_leads_id` are new columns."""

    __tablename__ = "engagements"

    idengagements = Column(Integer, primary_key=True, autoincrement=True)
    entities_entity_id = Column(Integer, nullable=False)
    assigned_user_id = Column(Integer, nullable=False)
    engagement_types_idengagement_types = Column(Integer, nullable=False)
    engagement_status_idengagement_status = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    created_by = Column(Integer, nullable=True)
    # ── new columns (managed by Alembic) ──
    phase = Column(String(100), nullable=True)
    crm_leads_id = Column(
        Integer, ForeignKey("crm_leads.idcrm_lead"), nullable=True
    )


class EngagementTaxYear(Base):
    __tablename__ = "engagement_tax_years"

    id = Column(Integer, primary_key=True, autoincrement=True)
    engagements_idengagements = Column(Integer, nullable=False)
    tax_year = Column(YEAR, nullable=False)


# ── CRM extension tables (created by Alembic) ──────────────────────────────────

class CrmLead(Base):
    __tablename__ = "crm_leads"

    idcrm_lead = Column(Integer, primary_key=True, autoincrement=True)
    # Nullable: a pre-client lead carries its contact info on crm_lead_profile
    # instead of a clients row (extra_db.md / my_update.md).
    clients_idclients = Column(
        Integer, ForeignKey("clients.idclients"), nullable=True
    )
    title = Column(String(255), nullable=True)
    research_type = Column(String(100), nullable=True)
    pipeline_status = Column(
        PIPELINE_ENUM, nullable=False, server_default=PipelineStatus.lead.value
    )
    lead_source = Column(String(100), nullable=True)
    salesperson_iduser = Column(
        Integer, ForeignKey("users.iduser"), nullable=True
    )
    notes = Column(Text, nullable=True)
    sow_signed_at = Column(DateTime, nullable=True)
    engagement_started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)
    updated_at = Column(DateTime, nullable=False, server_default=_UPDATED)

    __table_args__ = (Index("idx_crm_lead_status", "pipeline_status"),)


class CrmLeadProfile(Base):
    __tablename__ = "crm_lead_profile"

    idcrm_lead_profile = Column(Integer, primary_key=True, autoincrement=True)
    # Either link to a client account (returning/known client) or directly to a
    # lead (a clientless lead). At most one of these is set per profile.
    clients_idclients = Column(
        Integer, ForeignKey("clients.idclients"), nullable=True
    )
    crm_leads_id = Column(
        Integer,
        ForeignKey("crm_leads.idcrm_lead", ondelete="CASCADE"),
        nullable=True,
    )
    company = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)
    updated_at = Column(DateTime, nullable=False, server_default=_UPDATED)

    __table_args__ = (
        UniqueConstraint("clients_idclients", name="uq_crm_lead_profile_client"),
    )


class CrmIntakeQuestion(Base):
    __tablename__ = "crm_intake_questions"

    idcrm_intake_question = Column(Integer, primary_key=True, autoincrement=True)
    crm_leads_id = Column(
        Integer,
        ForeignKey("crm_leads.idcrm_lead", ondelete="CASCADE"),
        nullable=False,
    )
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, server_default=text("0"))
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)


class CrmFollowUpCall(Base):
    __tablename__ = "crm_follow_up_calls"

    idcrm_follow_up_call = Column(Integer, primary_key=True, autoincrement=True)
    crm_leads_id = Column(
        Integer,
        ForeignKey("crm_leads.idcrm_lead", ondelete="CASCADE"),
        nullable=False,
    )
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, nullable=False, server_default=text("0"))
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)
    updated_at = Column(DateTime, nullable=False, server_default=_UPDATED)


class CrmCalculation(Base):
    __tablename__ = "crm_calculations"

    idcrm_calculation = Column(Integer, primary_key=True, autoincrement=True)
    crm_leads_id = Column(
        Integer,
        ForeignKey("crm_leads.idcrm_lead", ondelete="CASCADE"),
        nullable=False,
    )
    tax_year = Column(Integer, nullable=False)
    tax_filing_status = Column(String(50), nullable=True)
    total_bill = Column(Numeric(12, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)
    created_by = Column(Integer, ForeignKey("users.iduser"), nullable=True)


class CrmCalculationEntity(Base):
    __tablename__ = "crm_calculation_entities"

    idcrm_calculation_entity = Column(Integer, primary_key=True, autoincrement=True)
    crm_calculations_id = Column(
        Integer,
        ForeignKey("crm_calculations.idcrm_calculation", ondelete="CASCADE"),
        nullable=False,
    )
    entities_entity_id = Column(
        Integer, ForeignKey("entities.entity_id"), nullable=True
    )
    entity_name = Column(String(255), nullable=False)
    state = Column(String(50), nullable=True)
    tax_filing_status = Column(String(50), nullable=True)
    # inputs
    employee_count = Column(Integer, nullable=True)
    estimate_qras = Column(Integer, nullable=True)
    gross_credit = Column(Numeric(12, 2), nullable=True)
    w2_wages = Column(Numeric(12, 2), nullable=True)
    contract_research = Column(Numeric(12, 2), nullable=True)
    supplies = Column(Numeric(12, 2), nullable=True)
    other_expenses = Column(Numeric(12, 2), nullable=True)
    manager_reviewed = Column(Boolean, nullable=False, server_default=text("0"))
    notes = Column(Text, nullable=True)
    # cached headline results
    tier = Column(String(45), nullable=True)
    total_bill = Column(Numeric(12, 2), nullable=True)
    grand_total = Column(Numeric(12, 2), nullable=True)
    # full CalcResult snapshot
    result_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)


class CrmEngagementBilling(Base):
    __tablename__ = "crm_engagement_billing"

    idcrm_engagement_billing = Column(Integer, primary_key=True, autoincrement=True)
    engagements_idengagements = Column(
        Integer, ForeignKey("engagements.idengagements"), nullable=False
    )
    tax_year = Column(YEAR, nullable=False)
    billing_amount = Column(Numeric(12, 2), nullable=False, server_default=text("0.00"))
    created_at = Column(DateTime, nullable=False, server_default=_CREATED)
    updated_at = Column(DateTime, nullable=False, server_default=_UPDATED)

    __table_args__ = (
        UniqueConstraint(
            "engagements_idengagements", "tax_year", name="uq_crm_eng_billing_year"
        ),
    )
