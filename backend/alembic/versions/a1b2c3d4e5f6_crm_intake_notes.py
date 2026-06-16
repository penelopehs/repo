"""crm intake notes (many notes per lead)

Revision ID: a1b2c3d4e5f6
Revises: 6d5bb791be5a
Create Date: 2026-06-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '6d5bb791be5a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('crm_intake_notes',
    sa.Column('idcrm_intake_note', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('crm_leads_id', sa.Integer(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('created_by_iduser', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['crm_leads_id'], ['crm_leads.crm_lead_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by_iduser'], ['users.iduser'], ),
    sa.PrimaryKeyConstraint('idcrm_intake_note')
    )
    op.create_index('idx_crm_intake_note_lead', 'crm_intake_notes', ['crm_leads_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_crm_intake_note_lead', table_name='crm_intake_notes')
    op.drop_table('crm_intake_notes')
