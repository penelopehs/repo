"""Tests for the lead-centric CRM router.

Covers the high-risk logic: clientless leads, contact resolution (from the
client's people), status-transition timestamps, the Lead->Calculation Sent
side effect when saving calculations, engagements, and the create/404/400/403
paths.
"""

from app import models
from tests.conftest import make_assignment


# ── Create ──────────────────────────────────────────────────────────────────────

def test_create_with_epr_resolves_company(client, db_session):
    # company is resolved from the linked entity graph seeded on create
    # (entities[0].name from the EPR's client roster).
    _, _, epr_id = make_assignment(db_session, firm="Cedar Labs")
    resp = client.post(
        "/leads",
        json={
            "epr_id": epr_id,
            "first_name": "Dana",
            "last_name": "Cedar",
            "email": "dr@cedar.test",
            "phone": "+1-555-0100",
            "lead_source": "Referral",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["pipeline_status"] == "New Lead"
    assert body["company"] == "Acme Health, PC"
    # Contact info is carried directly on the lead.
    assert body["full_name"] == "Dana Cedar"
    assert body["email"] == "dr@cedar.test"
    assert body["phone"] == "+1-555-0100"


def test_create_with_unknown_epr_id_404(client):
    resp = client.post(
        "/leads", json={"epr_id": 99999, "first_name": "Ghost", "last_name": "Lead"}
    )
    assert resp.status_code == 404


def test_create_clientless_lead(client, db_session):
    resp = client.post(
        "/leads",
        json={"first_name": "Harbor", "last_name": "Lead", "lead_source": "Inbound"},
    )
    assert resp.status_code == 201
    body = resp.json()
    # No epr/client -> no company resolved.
    assert body["company"] is None
    assert body["full_name"] == "Harbor Lead"


def test_create_requires_name(client):
    # first_name and last_name are both required.
    resp = client.post("/leads", json={"first_name": "OnlyFirst"})
    assert resp.status_code == 422


def test_create_saves_all_fields_and_seeds_calculations_blob(client, db_session):
    resp = client.post(
        "/leads",
        json={
            "first_name": "Jordan",
            "last_name": "Pike",
            "company": "Pike Diagnostics",
            "email": "jordan@pike.test",
            "phone": "+1-555-0142",
            "lead_source": "Webinar",
            "assigned_sales_rep": 1,
            "tax_years": [2025, 2026],
        },
    )
    assert resp.status_code == 201
    body = resp.json()

    # Lead-level fields land on the row.
    assert body["full_name"] == "Jordan Pike"
    assert body["email"] == "jordan@pike.test"
    assert body["phone"] == "+1-555-0142"
    assert body["lead_source"] == "Webinar"
    assert body["salesperson_iduser"] == 1
    # company is read back from the seeded JSON entity.
    assert body["company"] == "Pike Diagnostics"
    # tax_years come from the data blob's buckets; entities_count from its
    # entities list. Freshly seeded calcs carry no created_at yet.
    assert body["tax_years"] == [2025, 2026]
    assert body["entities_count"] == 1
    assert body["latest_calc_date"] is None

    # The JSON blob holds the entity + an empty bucket per tax year.
    lead = db_session.query(models.CrmLead).filter(
        models.CrmLead.crm_lead_id == body["id"]
    ).first()
    assert lead.data == {
        "entities": [{"id": "e_pike-diagnostics", "name": "Pike Diagnostics"}],
        "calculations": {"2025": [], "2026": []},
        "people": [],
        "entityPeople": {},
    }


def test_create_defaults_sales_rep_to_caller(client, db_session):
    body = client.post(
        "/leads", json={"first_name": "Default", "last_name": "Rep"}
    ).json()
    # The seeded caller user has iduser 1.
    assert body["salesperson_iduser"] == 1


def test_manager_assignments_create_list_and_update(client, db_session):
    coach = models.User(
        azure_ad_user_id="coach-oid",
        email="coach@test.local",
        first_name="Casey",
        last_name="Coach",
    )
    db_session.add(coach)
    db_session.commit()

    body = client.post(
        "/leads",
        json={
            "first_name": "Managed",
            "last_name": "Lead",
            "sales_manager_iduser": 1,
            "training_manager_iduser": coach.iduser,
        },
    ).json()
    assert body["sales_manager_iduser"] == 1
    assert body["sales_manager_name"] == "Test Caller"
    assert body["training_manager_iduser"] == coach.iduser
    assert body["training_manager_name"] == "Casey Coach"

    # Both assignments surface on the list endpoint too.
    row = client.get("/leads").json()[0]
    assert row["sales_manager_name"] == "Test Caller"
    assert row["training_manager_name"] == "Casey Coach"

    # PATCH can reassign one and unassign the other.
    updated = client.patch(
        f"/leads/{body['id']}",
        json={"sales_manager_iduser": coach.iduser, "training_manager_iduser": None},
    ).json()
    assert updated["sales_manager_iduser"] == coach.iduser
    assert updated["sales_manager_name"] == "Casey Coach"
    assert updated["training_manager_iduser"] is None
    assert updated["training_manager_name"] is None


def test_manager_assignments_default_to_none(client):
    body = client.post(
        "/leads", json={"first_name": "Plain", "last_name": "Lead"}
    ).json()
    assert body["sales_manager_iduser"] is None
    assert body["sales_manager_name"] is None
    assert body["training_manager_iduser"] is None
    assert body["training_manager_name"] is None


def test_create_stores_data_blob(client):
    payload = {"runs": [{"total_bill": 42.0}]}
    resp = client.post(
        "/leads",
        json={"first_name": "Calc", "last_name": "Lead", "data": payload},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["data"] == payload


def test_create_without_caller_user_403(client, claims):
    # An authenticated token whose oid has no users row -> 403.
    claims["oid"] = "ghost-oid"
    resp = client.post("/leads", json={"first_name": "Ghost", "last_name": "User"})
    assert resp.status_code == 403


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_filter_by_status(client):
    client.post("/leads", json={"first_name": "Lead", "last_name": "Co"})  # stays New Lead
    b = client.post("/leads", json={"first_name": "Closed", "last_name": "Co"}).json()
    client.patch(f"/leads/{b['id']}", json={"pipeline_status": "Closed"})

    resp = client.get("/leads", params={"status": "New Lead"})
    assert resp.status_code == 200
    statuses = {o["pipeline_status"] for o in resp.json()}
    assert statuses == {"New Lead"}


def test_list_resolves_company_from_client_people(client, db_session):
    # With no company seeded in the JSON, company falls back to entities[0].name
    # from the EPR-linked client graph.
    make_assignment(db_session, firm="Acme Labs")
    epr_id = db_session.query(models.EntityPeopleRole).first().identity_people_roles

    client.post("/leads", json={"epr_id": epr_id, "first_name": "Dana", "last_name": "Reed"})
    resp = client.get("/leads", params={"status": "New Lead"})
    item = next(o for o in resp.json() if o["full_name"] == "Dana Reed")
    assert item["company"] == "Acme Health, PC"


# ── Detail ──────────────────────────────────────────────────────────────────────

def test_get_detail_404(client):
    assert client.get("/leads/424242").status_code == 404


def test_detail_returns_data_blob(client, db_session):
    client_id, entity_id, epr_id = make_assignment(db_session)
    lead = client.post(
        "/leads",
        json={
            "epr_id": epr_id,
            "first_name": "Detail",
            "last_name": "Lead",
            "company": "Detail Co",
            "tax_years": [2024],
        },
    ).json()

    data = client.get(f"/leads/{lead['id']}").json()["data"]
    # Tax-year buckets come from the seed; the entity/people graph is pulled
    # from the EPR's client (replacing the seed "Detail Co" company name).
    assert data["calculations"] == {"2024": []}
    assert data["entities"] == [
        {
            "id": f"e_db_{entity_id}",
            "entityId": entity_id,
            "name": "Acme Health, PC",
            "ein": f"99-{client_id:07d}",
            "state": "CA",
            "city": "",
        }
    ]
    assert len(data["people"]) == 1
    person = data["people"][0]
    assert person["personId"] == int(person["id"])
    # The entity↔people link is seeded keyed by entity id → [person id].
    assert data["entityPeople"] == {f"e_db_{entity_id}": [person["id"]]}
    # Emails/phones are one-to-many lists (this seed person has none).
    assert {k: person[k] for k in (
        "firstName", "lastName", "title", "firm", "role", "emails", "phones",
    )} == {
        "firstName": "Dana", "lastName": "Reed", "title": "", "firm": "",
        "role": "Owner", "emails": [], "phones": [],
    }


# ── Update / status transitions ─────────────────────────────────────────────────

def test_patch_closed_sets_timestamp_idempotently(client):
    lead = client.post("/leads", json={"first_name": "Transition", "last_name": "Co"}).json()

    r1 = client.patch(f"/leads/{lead['id']}", json={"pipeline_status": "Closed"})
    assert r1.status_code == 200
    first_ts = r1.json()["sow_signed_at"]
    assert first_ts is not None

    # A later unrelated patch must not overwrite the original signature time.
    r2 = client.patch(f"/leads/{lead['id']}", json={"notes": "renamed"})
    assert r2.json()["sow_signed_at"] == first_ts


def test_patch_updates_data(client):
    lead = client.post("/leads", json={"first_name": "Patch", "last_name": "Calc"}).json()
    resp = client.patch(
        f"/leads/{lead['id']}", json={"data": {"total": 5}}
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == {"total": 5}


def test_patch_updates_all_fields(client, db_session):
    rep = models.User(
        azure_ad_user_id="rep-oid", email="rep@test.local",
        first_name="Sales", last_name="Rep",
    )
    db_session.add(rep)
    db_session.commit()
    _, _, epr_id = make_assignment(
        db_session, client_name="Reassign Co", firm="Reassign Firm"
    )

    lead = client.post("/leads", json={"first_name": "Before", "last_name": "Patch"}).json()
    resp = client.patch(
        f"/leads/{lead['id']}",
        json={
            "epr_id": epr_id,
            "first_name": "After",
            "last_name": "Patched",
            "email": "after@test.local",
            "phone": "+1-555-0199",
            "lead_source": "Outbound",
            "salesperson_iduser": rep.iduser,
            "notes": "updated",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["full_name"] == "After Patched"
    assert body["email"] == "after@test.local"
    assert body["phone"] == "+1-555-0199"
    assert body["lead_source"] == "Outbound"
    assert body["salesperson_iduser"] == rep.iduser
    assert body["salesperson_name"] == "Sales Rep"
    assert body["notes"] == "updated"
    # epr re-link resolves the lead's company (falls back to the client's firm).
    assert body["company"] == "Reassign Firm"


def test_patch_unknown_epr_404(client):
    lead = client.post("/leads", json={"first_name": "Bad", "last_name": "Epr"}).json()
    resp = client.patch(f"/leads/{lead['id']}", json={"epr_id": 999999})
    assert resp.status_code == 404


# ── Delete ──────────────────────────────────────────────────────────────────────

def test_delete_lead_keeps_client(client, db_session):
    client_id, _, epr_id = make_assignment(db_session, client_name="Keep Me Co")
    lead = client.post("/leads", json={"epr_id": epr_id, "first_name": "Keep", "last_name": "Me"}).json()

    assert client.delete(f"/leads/{lead['id']}").status_code == 204
    assert client.get(f"/leads/{lead['id']}").status_code == 404
    # The account (and its EPR assignment) survive the lead deletion.
    assert db_session.query(models.Client).filter(
        models.Client.idclients == client_id
    ).first() is not None
    assert db_session.query(models.EntityPeopleRole).filter(
        models.EntityPeopleRole.identity_people_roles == epr_id
    ).first() is not None


# ── Calculations ────────────────────────────────────────────────────────────────

def test_save_calculations_stores_blob_and_advances_status(client):
    lead = client.post("/leads", json={"first_name": "Calc", "last_name": "Co"}).json()
    assert lead["pipeline_status"] == "New Lead"

    blob = {
        "entities": [{"name": "Calc Co, PC"}, {"name": "Calc Co Holdings"}],
        "calculations": {
            "2023": {"created_at": 1700000000.0},
            "2024": {"created_at": 1710000000.0},
        },
        "people": [],
    }
    resp = client.put(f"/leads/{lead['id']}/calculations", json={"data": blob})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"] == blob
    # tax_years come from the per-year buckets; entities_count from the entities
    # list; latest_calc_date is the newest calculation's created_at.
    assert body["tax_years"] == [2023, 2024]
    assert body["entities_count"] == 2
    assert body["latest_calc_date"] == 1710000000.0
    # A fresh New Lead is moved to "Intro Call" when calculations are saved.
    assert body["pipeline_status"] == "Intro Call"


def test_clear_calculations(client):
    lead = client.post(
        "/leads",
        json={"first_name": "Del", "last_name": "Calc", "data": {"total": 10}},
    ).json()
    assert client.delete(f"/leads/{lead['id']}/calculations").status_code == 204
    detail = client.get(f"/leads/{lead['id']}").json()
    assert detail["data"] == []


# ── Engagements ─────────────────────────────────────────────────────────────────

def test_create_engagement_requires_client_entity(client):
    # Clientless lead -> cannot create an engagement (no entity to attach).
    lead = client.post("/leads", json={"first_name": "No", "last_name": "Entity", "lead_source": "Inbound"}).json()
    resp = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active"},
    )
    assert resp.status_code == 400


def test_create_engagement(client, db_session):
    _, _, epr_id = make_assignment(db_session)
    lead = client.post("/leads", json={"epr_id": epr_id, "first_name": "Eng", "last_name": "Lead"}).json()

    resp = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active", "phase": "Discovery"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["type"] == "R&D Tax Credit"
    assert body["status"] == "Active"
    assert body["phase"] == "Discovery"


def test_patch_engagement(client, db_session):
    _, _, epr_id = make_assignment(db_session)
    lead = client.post("/leads", json={"epr_id": epr_id, "first_name": "Eng", "last_name": "Lead"}).json()
    eng = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active"},
    ).json()

    resp = client.patch(f"/engagements/{eng['id']}", json={"phase": "Fieldwork"})
    assert resp.status_code == 200
    assert resp.json()["phase"] == "Fieldwork"


# ── Follow-up calls ─────────────────────────────────────────────────────────────

def test_follow_up_call_crud(client):
    lead = client.post("/leads", json={"first_name": "Calls", "last_name": "Lead"}).json()

    created = client.post(
        f"/leads/{lead['id']}/follow-up-calls",
        json={"scheduled_date": "2026-06-10", "scheduled_time": "10:00 AM", "notes": "intro"},
    )
    assert created.status_code == 201
    call = created.json()
    assert call["completed"] is False
    # A new lead's first call stamps "Intro Call" and advances the lead there.
    assert call["call_type"] == "Intro Call"
    assert client.get(f"/leads/{lead['id']}").json()["pipeline_status"] == "Intro Call"

    # Read: list for the lead.
    listed = client.get(f"/leads/{lead['id']}/follow-up-calls")
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()] == [call["id"]]

    # Update: lead-scoped patch. Completing a call does NOT advance the lead; the
    # pipeline advances when the next call is scheduled.
    patched = client.patch(
        f"/leads/{lead['id']}/follow-up-calls/{call['id']}", json={"completed": True}
    )
    assert patched.status_code == 200
    assert patched.json()["completed"] is True
    assert client.get(f"/leads/{lead['id']}").json()["pipeline_status"] == "Intro Call"

    # Scheduling the next call now that the previous one is completed advances
    # the lead +1 stage and stamps the new call's type.
    nxt = client.post(
        f"/leads/{lead['id']}/follow-up-calls",
        json={"scheduled_date": "2026-06-17", "notes": "feasibility"},
    )
    assert nxt.status_code == 201
    assert nxt.json()["call_type"] == "Feasibility Call"
    assert client.get(f"/leads/{lead['id']}").json()["pipeline_status"] == "Feasibility Call"

    # Scheduling another call while the latest is still open does NOT advance.
    pending = client.post(
        f"/leads/{lead['id']}/follow-up-calls",
        json={"scheduled_date": "2026-06-24"},
    )
    assert pending.status_code == 201
    assert pending.json()["call_type"] == "Feasibility Call"
    assert client.get(f"/leads/{lead['id']}").json()["pipeline_status"] == "Feasibility Call"

    # 404 when the call isn't on this lead (unknown call, or wrong lead).
    other = client.post("/leads", json={"first_name": "Other", "last_name": "Lead"}).json()
    assert (
        client.patch(
            f"/leads/{other['id']}/follow-up-calls/{call['id']}", json={"completed": False}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/leads/{lead['id']}/follow-up-calls/999999", json={"completed": False}
        ).status_code
        == 404
    )


def test_follow_up_call_on_missing_lead_404(client):
    resp = client.post(
        "/leads/999999/follow-up-calls",
        json={"scheduled_date": "2026-06-10"},
    )
    assert resp.status_code == 404


def test_detail_includes_next_call(client):
    # Regression: GET /leads/{id} (used by the pipeline's per-lead refresh after
    # the intro-call prompt) must report the next upcoming call, not null.
    lead = client.post("/leads", json={"first_name": "Next", "last_name": "Call"}).json()
    assert client.get(f"/leads/{lead['id']}").json()["next_call"] is None

    far = "2999-01-15"
    client.post(
        f"/leads/{lead['id']}/follow-up-calls",
        json={"scheduled_date": far, "scheduled_time": "10:00 AM", "notes": "intro"},
    )

    nc = client.get(f"/leads/{lead['id']}").json()["next_call"]
    assert nc is not None
    assert nc["date"] == far
    assert nc["call_type"] == "Intro Call"


def test_intake_note_crud(client):
    lead = client.post("/leads", json={"first_name": "Notes", "last_name": "Lead"}).json()

    # Create: many notes per lead, each stamped with the caller as author.
    first = client.post(
        f"/leads/{lead['id']}/intake-notes", json={"note": "Spoke with owner"}
    )
    assert first.status_code == 201
    note = first.json()
    assert note["note"] == "Spoke with owner"
    assert note["created_by_name"] == "Test Caller"

    second = client.post(
        f"/leads/{lead['id']}/intake-notes", json={"note": "Sent intro email"}
    )
    assert second.status_code == 201

    # Read: list for the lead (newest first), and surfaced on the lead detail.
    listed = client.get(f"/leads/{lead['id']}/intake-notes")
    assert listed.status_code == 200
    assert [n["id"] for n in listed.json()] == [second.json()["id"], note["id"]]

    detail = client.get(f"/leads/{lead['id']}").json()
    assert len(detail["intake_notes"]) == 2

    # Update: lead-scoped patch.
    patched = client.patch(
        f"/leads/{lead['id']}/intake-notes/{note['id']}", json={"note": "Owner called back"}
    )
    assert patched.status_code == 200
    assert patched.json()["note"] == "Owner called back"

    # Delete.
    assert client.delete(f"/leads/{lead['id']}/intake-notes/{note['id']}").status_code == 204
    assert [n["id"] for n in client.get(f"/leads/{lead['id']}/intake-notes").json()] == [
        second.json()["id"]
    ]

    # 404 when the note isn't on this lead (unknown note, or wrong lead).
    other = client.post("/leads", json={"first_name": "Other", "last_name": "Lead"}).json()
    assert (
        client.patch(
            f"/leads/{other['id']}/intake-notes/{second.json()['id']}", json={"note": "x"}
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/leads/{lead['id']}/intake-notes/999999", json={"note": "x"}
        ).status_code
        == 404
    )


def test_intake_note_on_missing_lead_404(client):
    resp = client.post("/leads/999999/intake-notes", json={"note": "x"})
    assert resp.status_code == 404
