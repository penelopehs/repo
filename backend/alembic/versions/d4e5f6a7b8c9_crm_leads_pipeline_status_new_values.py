"""add assigned_rep_name to crm_follow_up_calls

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-10 00:00:00.000000

call_type is added separately as an enum in revision e5f6a7b8c9d0.

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('crm_follow_up_calls', sa.Column('assigned_rep_name', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_follow_up_calls', 'assigned_rep_name')
