"""Tests for the lead-centric CRM router.

Covers the high-risk logic: clientless leads, contact resolution (from the
client's people), status-transition timestamps, the Lead->Calculation Sent
side effect when saving calculations, engagements, and the create/404/400/403
paths.
"""

from app import models
from tests.conftest import make_assignment


# ── Create ──────────────────────────────────────────────────────────────────────

def test_create_with_epr_resolves_client(client, db_session):
    client_id, _, epr_id = make_assignment(db_session, client_name="Cedar Valley Medical")
    resp = client.post(
        "/leads",
        json={
            "epr_id": epr_id,
            "full_name": "Dr. Cedar",
            "email": "dr@cedar.test",
            "phone": "+1-555-0100",
            "lead_source": "Referral",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["pipeline_status"] == "Lead"
    # The client is resolved through the EPR assignment (epr -> entity -> client).
    assert body["client_id"] == client_id
    assert body["client_name"] == "Cedar Valley Medical"
    # Contact info is carried directly on the lead.
    assert body["full_name"] == "Dr. Cedar"
    assert body["email"] == "dr@cedar.test"
    assert body["phone"] == "+1-555-0100"


def test_create_with_unknown_epr_id_404(client):
    resp = client.post("/leads", json={"epr_id": 99999, "full_name": "Ghost"})
    assert resp.status_code == 404


def test_create_clientless_lead(client, db_session):
    resp = client.post("/leads", json={"full_name": "Harbor Lead", "lead_source": "Inbound"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["client_id"] is None
    # No client -> no company resolved; client_name falls back to the lead's name.
    assert body["company"] is None
    assert body["client_name"] == "Harbor Lead"


def test_create_requires_full_name(client):
    resp = client.post("/leads", json={"client_name": "No Name Co"})
    assert resp.status_code == 422


def test_create_saves_all_fields_and_seeds_calculations_blob(client, db_session):
    resp = client.post(
        "/leads",
        json={
            "full_name": "Jordan Pike",
            "company": "Pike Diagnostics",
            "email": "jordan@pike.test",
            "phone": "+1-555-0142",
            "lead_source": "Webinar",
            "assigned_sales_rep": 1,
            "engagement_years": [2025, 2026],
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

    # The JSON blob holds the entity + an empty bucket per engagement year.
    lead = db_session.query(models.CrmLead).filter(
        models.CrmLead.crm_lead_id == body["id"]
    ).first()
    assert lead.calculations == {
        "entities": [{"name": "Pike Diagnostics"}],
        "calculations": {"2025": {}, "2026": {}},
        "people": [],
    }


def test_create_defaults_sales_rep_to_caller(client, db_session):
    body = client.post("/leads", json={"full_name": "Default Rep"}).json()
    # The seeded caller user has iduser 1.
    assert body["salesperson_iduser"] == 1


def test_create_stores_calculations_blob(client):
    payload = {"runs": [{"total_bill": 42.0}]}
    resp = client.post(
        "/leads",
        json={"client_name": "Calc Co", "full_name": "Calc Lead", "calculations": payload},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["calculations"] == payload


def test_create_without_caller_user_403(client, claims):
    # An authenticated token whose oid has no users row -> 403.
    claims["oid"] = "ghost-oid"
    resp = client.post("/leads", json={"full_name": "Ghost"})
    assert resp.status_code == 403


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_filter_by_status(client):
    client.post("/leads", json={"client_name": "Lead Co", "full_name": "A"})  # stays Lead
    b = client.post("/leads", json={"client_name": "Signed Co", "full_name": "B"}).json()
    client.patch(f"/leads/{b['id']}", json={"pipeline_status": "SOW Signed"})

    resp = client.get("/leads", params={"status": "Lead"})
    assert resp.status_code == 200
    statuses = {o["pipeline_status"] for o in resp.json()}
    assert statuses == {"Lead"}


def test_list_resolves_company_from_client_people(client, db_session):
    # With no company seeded in the JSON, company falls back to the firm of the
    # people behind the lead's client (resolved via epr -> entity -> client).
    client_id, _, epr_id = make_assignment(db_session, firm="Acme Labs")

    client.post("/leads", json={"epr_id": epr_id, "full_name": "Dana Reed"})
    resp = client.get("/leads", params={"status": "Lead"})
    item = next(o for o in resp.json() if o["client_id"] == client_id)
    assert item["company"] == "Acme Labs"


# ── Detail ──────────────────────────────────────────────────────────────────────

def test_get_detail_404(client):
    assert client.get("/leads/424242").status_code == 404


def test_detail_includes_sub_entities(client, db_session):
    _, _, epr_id = make_assignment(db_session)
    lead = client.post("/leads", json={"epr_id": epr_id, "full_name": "Detail Lead"}).json()

    resp = client.get(f"/leads/{lead['id']}")
    assert resp.status_code == 200
    body = resp.json()
    names = {e["name"] for e in body["sub_entities"]}
    assert "Acme Health, PC" in names


# ── Update / status transitions ─────────────────────────────────────────────────

def test_patch_sow_signed_sets_timestamp_idempotently(client):
    lead = client.post("/leads", json={"client_name": "Transition Co", "full_name": "T"}).json()

    r1 = client.patch(f"/leads/{lead['id']}", json={"pipeline_status": "SOW Signed"})
    assert r1.status_code == 200
    first_ts = r1.json()["sow_signed_at"]
    assert first_ts is not None

    # A later unrelated patch must not overwrite the original signature time.
    r2 = client.patch(f"/leads/{lead['id']}", json={"notes": "renamed"})
    assert r2.json()["sow_signed_at"] == first_ts


def test_patch_updates_calculations(client):
    lead = client.post("/leads", json={"client_name": "Patch Calc Co", "full_name": "P"}).json()
    resp = client.patch(
        f"/leads/{lead['id']}", json={"calculations": {"total": 5}}
    )
    assert resp.status_code == 200
    assert resp.json()["calculations"] == {"total": 5}


# ── Delete ──────────────────────────────────────────────────────────────────────

def test_delete_lead_keeps_client(client, db_session):
    client_id, _, epr_id = make_assignment(db_session, client_name="Keep Me Co")
    lead = client.post("/leads", json={"epr_id": epr_id, "full_name": "K"}).json()

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
    lead = client.post("/leads", json={"client_name": "Calc Co", "full_name": "C"}).json()
    assert lead["pipeline_status"] == "Lead"

    blob = {
        "tax_year": 2024,
        "total_bill": 150.0,
        "entities": [{"entity_name": "Calc Co, PC", "grand_total": 100.0}],
    }
    resp = client.put(f"/leads/{lead['id']}/calculations", json={"calculations": blob})
    assert resp.status_code == 200
    body = resp.json()
    assert body["calculations"] == blob
    # The headline total is read best-effort from the blob.
    assert body["latest_calc_total"] == 150.0
    # A fresh Lead is moved to "Calculation Sent".
    assert body["pipeline_status"] == "Calculation Sent"


def test_clear_calculations(client):
    lead = client.post(
        "/leads",
        json={"client_name": "Del Calc Co", "full_name": "D", "calculations": {"total": 10}},
    ).json()
    assert client.delete(f"/leads/{lead['id']}/calculations").status_code == 204
    detail = client.get(f"/leads/{lead['id']}").json()
    assert detail["calculations"] == []


# ── Engagements ─────────────────────────────────────────────────────────────────

def test_create_engagement_requires_client_entity(client):
    # Clientless lead -> cannot create an engagement (no entity to attach).
    lead = client.post("/leads", json={"full_name": "No Entity", "lead_source": "Inbound"}).json()
    resp = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active"},
    )
    assert resp.status_code == 400


def test_create_engagement(client, db_session):
    _, _, epr_id = make_assignment(db_session)
    lead = client.post("/leads", json={"epr_id": epr_id, "full_name": "Eng Lead"}).json()

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
    lead = client.post("/leads", json={"epr_id": epr_id, "full_name": "Eng Lead"}).json()
    eng = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active"},
    ).json()

    resp = client.patch(f"/engagements/{eng['id']}", json={"phase": "Fieldwork"})
    assert resp.status_code == 200
    assert resp.json()["phase"] == "Fieldwork"


# ── Follow-up calls ─────────────────────────────────────────────────────────────

def test_follow_up_call_crud(client):
    lead = client.post("/leads", json={"client_name": "Calls Co", "full_name": "Calls Lead"}).json()

    created = client.post(
        f"/leads/{lead['id']}/follow-up-calls",
        json={"scheduled_date": "2026-06-10", "scheduled_time": "10:00 AM", "notes": "intro"},
    )
    assert created.status_code == 201
    call = created.json()
    assert call["completed"] is False

    patched = client.patch(f"/follow-up-calls/{call['id']}", json={"completed": True})
    assert patched.status_code == 200
    assert patched.json()["completed"] is True

    assert client.delete(f"/follow-up-calls/{call['id']}").status_code == 204
    assert client.delete(f"/follow-up-calls/{call['id']}").status_code == 404


def test_follow_up_call_on_missing_lead_404(client):
    resp = client.post(
        "/leads/999999/follow-up-calls",
        json={"scheduled_date": "2026-06-10"},
    )
    assert resp.status_code == 404
