"""crm leads pipeline_status new enum values

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

ENUM_NAME = 'crm_leads_pipeline_status'

OLD_VALUES = ('Lead', 'Calculation Sent', 'SOW Signed', 'Active Engagement')
NEW_VALUES = ('New Lead', 'Intro Call', 'Feasibility Call', 'Tax Preparer Coordination', 'Closed')

# Union covers both sets so rows remain valid while we remap them.
UNION_VALUES = OLD_VALUES + NEW_VALUES


def upgrade() -> None:
    # 1. Widen the enum to a superset so the new target value is assignable.
    op.alter_column(
        'crm_leads', 'pipeline_status',
        existing_type=sa.Enum(*OLD_VALUES, name=ENUM_NAME),
        type_=sa.Enum(*UNION_VALUES, name=ENUM_NAME),
        existing_nullable=False,
    )
    # 2. Reset every existing lead to the new initial status.
    op.execute("UPDATE crm_leads SET pipeline_status = 'New Lead'")
    # 3. Narrow to the final enum and update the column default.
    op.alter_column(
        'crm_leads', 'pipeline_status',
        existing_type=sa.Enum(*UNION_VALUES, name=ENUM_NAME),
        type_=sa.Enum(*NEW_VALUES, name=ENUM_NAME),
        existing_nullable=False,
        server_default='New Lead',
    )


def downgrade() -> None:
    op.alter_column(
        'crm_leads', 'pipeline_status',
        existing_type=sa.Enum(*NEW_VALUES, name=ENUM_NAME),
        type_=sa.Enum(*UNION_VALUES, name=ENUM_NAME),
        existing_nullable=False,
    )
    op.execute("UPDATE crm_leads SET pipeline_status = 'Lead'")
    op.alter_column(
        'crm_leads', 'pipeline_status',
        existing_type=sa.Enum(*UNION_VALUES, name=ENUM_NAME),
        type_=sa.Enum(*OLD_VALUES, name=ENUM_NAME),
        existing_nullable=False,
        server_default='Lead',
    )
