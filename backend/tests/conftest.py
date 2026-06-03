"""Pytest fixtures for the FastAPI backend.

Tests run against an in-memory SQLite database. Two MySQL-isms in the models
don't translate to SQLite and are patched here before the schema is created:

  * ``mysql.YEAR`` columns  -> compiled as plain ``INTEGER`` on SQLite.
  * ``CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`` server defaults -> reduced
    to ``CURRENT_TIMESTAMP`` (SQLite rejects the ``ON UPDATE`` clause as DDL, and
    won't auto-bump ``updated_at`` regardless — so don't assert on that in tests).

The two app dependencies — ``verify_token`` (Azure JWT) and ``get_db`` — are
overridden so tests never touch Azure or a real MySQL server.
"""

import os

# Azure settings are read at import time by app.auth.Settings(); provide dummies
# BEFORE importing anything under `app`. DATABASE_URL is set to sqlite so the
# module-level engine in app.database never tries to reach MySQL.
os.environ.setdefault("AZURE_TENANT_ID", "test-tenant")
os.environ.setdefault("AZURE_CLIENT_ID", "test-client")
os.environ.setdefault("AZURE_CLIENT_SECRET", "test-secret")
os.environ.setdefault("JWT_AUDIENCE", "test-audience")
os.environ.setdefault("DATABASE_URL", "sqlite://")

# app.graph instantiates an MSAL ConfidentialClientApplication at import time,
# which validates the (dummy) authority and would otherwise reach the network.
# Swap in a no-op stub before importing the app — SharePoint/Graph isn't under test.
import sys
import types

_fake_msal = types.ModuleType("msal")


class _FakeConfidentialClientApplication:  # pragma: no cover - test stub
    def __init__(self, *args, **kwargs):
        pass

    def acquire_token_on_behalf_of(self, *args, **kwargs):
        return {"access_token": "test-graph-token"}


_fake_msal.ConfidentialClientApplication = _FakeConfidentialClientApplication
sys.modules["msal"] = _fake_msal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.mysql import YEAR
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.schema import DefaultClause

from app import models
from app.auth import verify_token
from app.database import Base, get_db
from app.main import app


# ── SQLite compatibility shims (applied once, at import) ────────────────────────

@compiles(YEAR, "sqlite")
def _compile_year_sqlite(element, compiler, **kw):  # noqa: ANN001
    return "INTEGER"


def _sanitize_metadata_for_sqlite() -> None:
    """Strip the MySQL-only ``ON UPDATE`` clause from server defaults so
    ``create_all`` produces valid SQLite DDL while keeping a default value
    (the columns are NOT NULL)."""
    for table in Base.metadata.tables.values():
        for col in table.columns:
            sd = col.server_default
            if isinstance(sd, DefaultClause):
                arg = getattr(sd, "arg", None)
                arg_txt = "" if arg is None else str(arg)
                if "ON UPDATE" in arg_txt.upper():
                    col.server_default = DefaultClause(text("CURRENT_TIMESTAMP"))


_sanitize_metadata_for_sqlite()


# ── Database fixtures ───────────────────────────────────────────────────────────

CALLER_OID = "caller-oid"  # the authenticated user in most tests


@pytest.fixture
def db_session():
    """A fresh in-memory SQLite DB per test, with the minimal lookup rows the
    endpoints depend on already seeded."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # one shared connection => one in-memory DB
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # Lookup seed: an active client status (used by the create-from-name flow)
    # and the caller's users row (resolved by _caller via the token's oid).
    session.add(
        models.ClientStatusRef(
            status_name="Active", description="Active", is_active=True, sort_order=1
        )
    )
    session.add(
        models.User(
            azure_ad_user_id=CALLER_OID,
            email="caller@test.local",
            first_name="Test",
            last_name="Caller",
        )
    )
    session.commit()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def claims():
    """Mutable token claims returned by the overridden verify_token. Tests may
    edit this dict (e.g. swap the oid) before issuing a request."""
    return {
        "oid": CALLER_OID,
        "name": "Test Caller",
        "preferred_username": "caller@test.local",
        "given_name": "Test",
        "family_name": "Caller",
    }


@pytest.fixture
def client(db_session, claims):
    """A TestClient with auth + DB dependencies overridden. All requests share
    the single ``db_session`` (so endpoint commits are visible to test queries)."""

    def _get_db_override():
        yield db_session

    def _verify_override():
        return claims

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[verify_token] = _verify_override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


# ── Arrange helpers ─────────────────────────────────────────────────────────────

def make_client_with_entity(db_session, *, client_name="Acme Health", entity_name="Acme Health, PC"):
    """Insert a clients row + one entity and return (client_id, entity_id)."""
    c = models.Client(client_name=client_name, client_status_idclient_status=1, created_by=1)
    db_session.add(c)
    db_session.flush()
    e = models.Entity(
        clients_idclients=c.idclients,
        entity_name=entity_name,
        state="CA",
        ein=f"99-{c.idclients:07d}",
    )
    db_session.add(e)
    db_session.commit()
    return c.idclients, e.entity_id


def make_assignment(
    db_session,
    *,
    client_name="Acme Health",
    entity_name="Acme Health, PC",
    first_name="Dana",
    last_name="Reed",
    role_name="Owner",
    firm=None,
):
    """Insert a client + entity + person + role and the entity_people_roles link
    that joins them. Returns (client_id, entity_id, epr_id)."""
    client_id, entity_id = make_client_with_entity(
        db_session, client_name=client_name, entity_name=entity_name
    )
    person = models.Person(first_name=first_name, last_name=last_name, firm=firm)
    role = models.PeopleRole(role_name=role_name)
    db_session.add_all([person, role])
    db_session.flush()
    epr = models.EntityPeopleRole(
        entities_entity_id=entity_id,
        people_idperson=person.idperson,
        roles_idroles=role.idroles,
    )
    db_session.add(epr)
    db_session.commit()
    return client_id, entity_id, epr.identity_people_roles
