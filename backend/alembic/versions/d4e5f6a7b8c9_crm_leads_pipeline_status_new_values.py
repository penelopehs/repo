"""add call_type and assigned_rep_name to crm_follow_up_calls

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


def upgrade() -> None:
    op.add_column('crm_follow_up_calls', sa.Column('call_type', sa.String(100), nullable=True))
    op.add_column('crm_follow_up_calls', sa.Column('assigned_rep_name', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_follow_up_calls', 'assigned_rep_name')
    op.drop_column('crm_follow_up_calls', 'call_type')
