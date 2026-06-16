"""crm leads optional sales/training manager assignments

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-06-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('crm_leads', sa.Column('sales_manager_iduser', sa.Integer(), nullable=True))
    op.add_column('crm_leads', sa.Column('training_manager_iduser', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_crm_leads_sales_manager_users', 'crm_leads', 'users',
        ['sales_manager_iduser'], ['iduser'],
    )
    op.create_foreign_key(
        'fk_crm_leads_training_manager_users', 'crm_leads', 'users',
        ['training_manager_iduser'], ['iduser'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_crm_leads_training_manager_users', 'crm_leads', type_='foreignkey')
    op.drop_constraint('fk_crm_leads_sales_manager_users', 'crm_leads', type_='foreignkey')
    op.drop_column('crm_leads', 'training_manager_iduser')
    op.drop_column('crm_leads', 'sales_manager_iduser')
