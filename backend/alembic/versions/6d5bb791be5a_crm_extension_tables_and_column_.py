"""crm extension tables and column additions

Revision ID: 6d5bb791be5a
Revises:
Create Date: 2026-05-29 11:04:48.629041

"""
from alembic import op
import sqlalchemy as sa

revision = '6d5bb791be5a'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # crm_leads is created first because the child tables reference it.
    op.create_table('crm_leads',
    sa.Column('crm_lead_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('clients_idclients', sa.Integer(), nullable=True),
    sa.Column('pipeline_status', sa.Enum('Lead', 'Calculation Sent', 'SOW Signed', 'Active Engagement', name='crm_leads_pipeline_status'), server_default='Lead', nullable=False),
    sa.Column('lead_source', sa.String(length=100), nullable=True),
    sa.Column('salesperson_iduser', sa.Integer(), nullable=True),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('calculations', sa.JSON(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('sow_signed_at', sa.DateTime(), nullable=True),
    sa.Column('engagement_started_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['clients_idclients'], ['clients.idclients'], ),
    sa.ForeignKeyConstraint(['salesperson_iduser'], ['users.iduser'], ),
    sa.PrimaryKeyConstraint('crm_lead_id')
    )
    op.create_index('idx_crm_lead_status', 'crm_leads', ['pipeline_status'], unique=False)
    op.create_table('crm_follow_up_calls',
    sa.Column('idcrm_follow_up_call', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('crm_leads_id', sa.Integer(), nullable=False),
    sa.Column('scheduled_date', sa.Date(), nullable=False),
    sa.Column('scheduled_time', sa.String(length=20), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('completed', sa.Boolean(), server_default=sa.text('0'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['crm_leads_id'], ['crm_leads.crm_lead_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('idcrm_follow_up_call')
    )
    op.create_table('crm_intake_questions',
    sa.Column('idcrm_intake_question', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('crm_leads_id', sa.Integer(), nullable=False),
    sa.Column('question', sa.Text(), nullable=False),
    sa.Column('answer', sa.Text(), nullable=True),
    sa.Column('display_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['crm_leads_id'], ['crm_leads.crm_lead_id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('idcrm_intake_question')
    )
    op.add_column('engagements', sa.Column('phase', sa.String(length=100), nullable=True))
    op.add_column('engagements', sa.Column('crm_leads_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'engagements', 'crm_leads', ['crm_leads_id'], ['crm_lead_id'])
    op.add_column('people', sa.Column('title', sa.String(length=150), nullable=True))
    op.add_column('people', sa.Column('firm', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('people', 'firm')
    op.drop_column('people', 'title')
    op.drop_constraint(None, 'engagements', type_='foreignkey')
    op.drop_column('engagements', 'crm_leads_id')
    op.drop_column('engagements', 'phase')
    op.drop_table('crm_intake_questions')
    op.drop_table('crm_follow_up_calls')
    op.drop_index('idx_crm_lead_status', table_name='crm_leads')
    op.drop_table('crm_leads')
