"""crm follow-up call assigned_rep_name column

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('crm_follow_up_calls', sa.Column('assigned_rep_name', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_follow_up_calls', 'assigned_rep_name')
