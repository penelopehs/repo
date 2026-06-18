"""feasibility call drafts: status + current_step

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-06-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "h8i9j0k1l2m3"
down_revision = "g7h8i9j0k1l2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "crm_feasibility_calls",
        sa.Column(
            "status",
            sa.String(20),
            server_default=sa.text("'draft'"),
            nullable=False,
        ),
    )
    op.add_column(
        "crm_feasibility_calls",
        sa.Column("current_step", sa.Integer(), nullable=True),
    )
    # Every pre-existing row was created by the Submit action (drafts did not
    # live in the DB before this revision), so backfill them as submitted to
    # keep them out of the draft picker.
    op.execute("UPDATE crm_feasibility_calls SET status = 'submitted'")


def downgrade() -> None:
    op.drop_column("crm_feasibility_calls", "current_step")
    op.drop_column("crm_feasibility_calls", "status")
