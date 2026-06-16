"""crm feasibility calls table

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_feasibility_calls",
        sa.Column("idcrm_feasibility_call", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crm_leads_id", sa.Integer(), nullable=False),
        sa.Column("call_setup", sa.JSON(), nullable=False),
        sa.Column("components", sa.JSON(), nullable=False),
        sa.Column("generated_output", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["crm_leads_id"],
            ["crm_leads.crm_lead_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("idcrm_feasibility_call"),
    )
    op.create_index(
        "idx_crm_feasibility_call_lead",
        "crm_feasibility_calls",
        ["crm_leads_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_crm_feasibility_call_lead", table_name="crm_feasibility_calls")
    op.drop_table("crm_feasibility_calls")