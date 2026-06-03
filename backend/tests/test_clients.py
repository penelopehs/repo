"""Tests for the read-only clients API.

GET /clients returns the entity_people_roles join (identity_people_roles,
entity_name, first_name, last_name, role_name, created_at) plus all of the
person's emails and phones.
"""

from datetime import datetime

from app import models


def _seed_assignment(
    db_session, *, entity_name, first_name, last_name, role_name,
    emails=(), phones=(),
):
    """Insert an entity + person + role and the entity_people_roles link that
    joins them (optionally with the person's emails/phones). Returns the link id.

    `emails`/`phones` items are either a plain string or a (value, is_primary)
    tuple."""
    entity = models.Entity(clients_idclients=1, entity_name=entity_name)
    person = models.Person(first_name=first_name, last_name=last_name)
    role = models.PeopleRole(role_name=role_name)
    db_session.add_all([entity, person, role])
    db_session.flush()
    for item in emails:
        value, is_primary = item if isinstance(item, tuple) else (item, False)
        db_session.add(models.PeopleEmail(
            people_idperson=person.idperson, email=value, is_primary=is_primary
        ))
    for item in phones:
        value, is_primary = item if isinstance(item, tuple) else (item, False)
        db_session.add(models.PeoplePhone(
            people_idperson=person.idperson, phone=value, is_primary=is_primary
        ))
    link = models.EntityPeopleRole(
        entities_entity_id=entity.entity_id,
        people_idperson=person.idperson,
        roles_idroles=role.idroles,
        created_at=datetime(2026, 1, 2, 3, 4, 5),
    )
    db_session.add(link)
    db_session.commit()
    return link.identity_people_roles


def test_list_returns_join_rows(client, db_session):
    link_id = _seed_assignment(
        db_session,
        entity_name="Acme Health, PC",
        first_name="Dana",
        last_name="Reed",
        role_name="Owner",
    )

    resp = client.get("/clients")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    row = rows[0]
    assert row == {
        "identity_people_roles": link_id,
        "entity_name": "Acme Health, PC",
        "first_name": "Dana",
        "last_name": "Reed",
        "role_name": "Owner",
        "emails": [],
        "phones": [],
        "created_at": "2026-01-02T03:04:05",
    }


def test_list_returns_all_emails_and_phones_primary_first(client, db_session):
    _seed_assignment(
        db_session,
        entity_name="Acme Health, PC",
        first_name="Dana",
        last_name="Reed",
        role_name="Owner",
        emails=["dana@work.test", ("dana@primary.test", True)],
        phones=[("+1-555-0001", True), "+1-555-0002"],
    )

    rows = client.get("/clients").json()
    assert len(rows) == 1
    # Primary first, then the rest.
    assert rows[0]["emails"] == ["dana@primary.test", "dana@work.test"]
    assert rows[0]["phones"] == ["+1-555-0001", "+1-555-0002"]


def test_list_inner_joins_skip_unlinked_people(client, db_session):
    # A person/entity/role with no entity_people_roles link must NOT appear
    # (the query uses inner joins).
    db_session.add(models.Entity(clients_idclients=1, entity_name="Orphan Co"))
    db_session.add(models.Person(first_name="No", last_name="Link"))
    db_session.add(models.PeopleRole(role_name="Ghost"))
    db_session.commit()

    _seed_assignment(
        db_session,
        entity_name="Linked Co",
        first_name="Jamie",
        last_name="Cruz",
        role_name="Manager",
    )

    resp = client.get("/clients")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["entity_name"] == "Linked Co"


def test_list_empty_when_no_assignments(client):
    resp = client.get("/clients")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Search (first_name / last_name / company, each '%q%') ───────────────────────

def _seed_three(db_session):
    _seed_assignment(
        db_session, entity_name="Cedar Valley Medical",
        first_name="Dana", last_name="Reed", role_name="Owner",
    )
    _seed_assignment(
        db_session, entity_name="Summit Orthopedics",
        first_name="Danny", last_name="Cruz", role_name="Manager",
    )
    _seed_assignment(
        db_session, entity_name="Lakeside Dental",
        first_name="Mia", last_name="Reedy", role_name="Owner",
    )


def test_search_by_first_name_substring_case_insensitive(client, db_session):
    _seed_three(db_session)
    rows = client.get("/clients", params={"first_name": "dan"}).json()
    assert {r["first_name"] for r in rows} == {"Dana", "Danny"}


def test_search_by_last_name_substring(client, db_session):
    _seed_three(db_session)
    rows = client.get("/clients", params={"last_name": "reed"}).json()
    assert {r["last_name"] for r in rows} == {"Reed", "Reedy"}


def test_search_by_company_substring(client, db_session):
    _seed_three(db_session)
    rows = client.get("/clients", params={"company": "val"}).json()
    assert {r["entity_name"] for r in rows} == {"Cedar Valley Medical"}


def test_search_params_combine_with_and(client, db_session):
    _seed_three(db_session)
    rows = client.get(
        "/clients", params={"first_name": "dan", "last_name": "cruz"}
    ).json()
    assert len(rows) == 1
    assert rows[0]["first_name"] == "Danny"


def test_blank_search_returns_all(client, db_session):
    _seed_three(db_session)
    rows = client.get("/clients", params={"first_name": "   "}).json()
    assert len(rows) == 3
