import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from app.models import Base  # noqa: E402 — must come after sys.path insert
from app.database import build_database_url  # noqa: E402 — same, after sys.path insert

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Share the app's connection logic so migrations honour the MYSQL_* settings
# (incl. the SSL CA cert) instead of only DATABASE_URL.
db_url, connect_args = build_database_url()
config.set_main_option("sqlalchemy.url", db_url)


# ── Autogenerate scoping ───────────────────────────────────────────────────────
# The base `acquirewc_dev` schema (~40+ tables) is provisioned outside the app and
# must NOT be touched by autogenerate. Alembic only manages the new CRM extension
# tables, plus the handful of new columns added to two existing tables.

CRM_TABLES = {
    "crm_leads",
    "crm_intake_questions",
    "crm_follow_up_calls",
}
# Existing tables we extend -> the ONLY columns autogenerate may manage on them.
EXTENDED_COLUMNS = {
    "engagements": {"phase", "crm_leads_id"},
    "people": {"title", "firm"},
}


def include_name(name, type_, parent_names):
    # Restrict reflection so the ~40 base tables are never seen as drop candidates.
    if type_ == "table":
        return name in CRM_TABLES or name in EXTENDED_COLUMNS
    return True


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in CRM_TABLES or name in EXTENDED_COLUMNS
    if type_ == "column":
        table = obj.table.name
        if table in CRM_TABLES:
            return True
        if table in EXTENDED_COLUMNS:
            return name in EXTENDED_COLUMNS[table]
        return False
    if type_ in ("index", "unique_constraint"):
        table = getattr(getattr(obj, "table", None), "name", None)
        return table in CRM_TABLES
    if type_ == "foreign_key_constraint":
        table = obj.parent.name if hasattr(obj, "parent") else obj.table.name
        if table in CRM_TABLES:
            return True
        if table == "engagements":
            return "crm_leads_id" in {c.name for c in obj.columns}
        return False
    return False


_CONFIGURE_KW = dict(
    target_metadata=target_metadata,
    include_name=include_name,
    include_object=include_object,
    compare_type=False,
    compare_server_default=False,
)


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_CONFIGURE_KW,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, **_CONFIGURE_KW)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
