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
    # company is resolved through the EPR assignment (epr -> entity -> client
    # people firm) when none is seeded in the data blob.
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
    assert body["pipeline_status"] == "Lead"
    assert body["company"] == "Cedar Labs"
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
        "entities": [{"name": "Pike Diagnostics"}],
        "calculations": {"2025": {}, "2026": {}},
        "people": [],
    }


def test_create_defaults_sales_rep_to_caller(client, db_session):
    body = client.post(
        "/leads", json={"first_name": "Default", "last_name": "Rep"}
    ).json()
    # The seeded caller user has iduser 1.
    assert body["salesperson_iduser"] == 1


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
    client.post("/leads", json={"first_name": "Lead", "last_name": "Co"})  # stays Lead
    b = client.post("/leads", json={"first_name": "Signed", "last_name": "Co"}).json()
    client.patch(f"/leads/{b['id']}", json={"pipeline_status": "SOW Signed"})

    resp = client.get("/leads", params={"status": "Lead"})
    assert resp.status_code == 200
    statuses = {o["pipeline_status"] for o in resp.json()}
    assert statuses == {"Lead"}


def test_list_resolves_company_from_client_people(client, db_session):
    # With no company seeded in the JSON, company falls back to the firm of the
    # people behind the lead's client (resolved via epr -> entity -> client).
    make_assignment(db_session, firm="Acme Labs")
    epr_id = db_session.query(models.EntityPeopleRole).first().identity_people_roles

    client.post("/leads", json={"epr_id": epr_id, "first_name": "Dana", "last_name": "Reed"})
    resp = client.get("/leads", params={"status": "Lead"})
    item = next(o for o in resp.json() if o["full_name"] == "Dana Reed")
    assert item["company"] == "Acme Labs"


# ── Detail ──────────────────────────────────────────────────────────────────────

def test_get_detail_404(client):
    assert client.get("/leads/424242").status_code == 404


def test_detail_returns_data_blob(client, db_session):
    _, _, epr_id = make_assignment(db_session)
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

    body = client.get(f"/leads/{lead['id']}").json()
    assert body["data"] == {
        "entities": [{"name": "Detail Co"}],
        "calculations": {"2024": {}},
        "people": [],
    }


# ── Update / status transitions ─────────────────────────────────────────────────

def test_patch_sow_signed_sets_timestamp_idempotently(client):
    lead = client.post("/leads", json={"first_name": "Transition", "last_name": "Co"}).json()

    r1 = client.patch(f"/leads/{lead['id']}", json={"pipeline_status": "SOW Signed"})
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
    assert lead["pipeline_status"] == "Lead"

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
    # A fresh Lead is moved to "Calculation Sent".
    assert body["pipeline_status"] == "Calculation Sent"


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

    # Read: list for the lead.
    listed = client.get(f"/leads/{lead['id']}/follow-up-calls")
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()] == [call["id"]]

    # Update: lead-scoped patch.
    patched = client.patch(
        f"/leads/{lead['id']}/follow-up-calls/{call['id']}", json={"completed": True}
    )
    assert patched.status_code == 200
    assert patched.json()["completed"] is True

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
