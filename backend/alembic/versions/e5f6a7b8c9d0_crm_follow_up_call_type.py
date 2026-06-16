"""crm follow-up call call_type column

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None

ENUM_NAME = 'crm_follow_up_calls_call_type'

# Mirrors PipelineStatus[1:] (every stage past "New Lead").
CALL_TYPE_VALUES = ('Intro Call', 'Feasibility Call', 'Tax Preparer Coordination', 'Closed')


def upgrade() -> None:
    op.add_column(
        'crm_follow_up_calls',
        sa.Column(
            'call_type',
            sa.Enum(*CALL_TYPE_VALUES, name=ENUM_NAME),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('crm_follow_up_calls', 'call_type')
