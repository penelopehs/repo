"""Tests for the lead-centric CRM router.

Covers the high-risk logic: clientless leads, contact resolution, status-
transition timestamps, the Lead->Calculation Sent side effect, engagement
billing replace semantics, and the create/404/400/403 paths.
"""

from app import models
from tests.conftest import make_client_with_entity


# ── Create ──────────────────────────────────────────────────────────────────────

def test_create_with_new_client_name_creates_client(client, db_session):
    resp = client.post(
        "/leads",
        json={"client_name": "Cedar Valley Medical", "title": "R&D Study",
              "company": "Cedar Valley Medical", "email": "info@cv.test"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["pipeline_status"] == "Lead"
    assert body["client_id"] is not None

    # A clients row was created and a lead profile keyed by that client.
    c = db_session.query(models.Client).filter(
        models.Client.idclients == body["client_id"]
    ).first()
    assert c is not None and c.client_name == "Cedar Valley Medical"
    prof = db_session.query(models.CrmLeadProfile).filter(
        models.CrmLeadProfile.clients_idclients == body["client_id"]
    ).first()
    assert prof is not None and prof.email == "info@cv.test"


def test_create_clientless_lead_keeps_profile_lead_scoped(client, db_session):
    resp = client.post(
        "/leads",
        json={"company": "Harborview Cardiology", "email": "hi@harborview.test",
              "title": "Inbound"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["client_id"] is None
    # client_name falls back to company when there's no client.
    assert body["client_name"] == "Harborview Cardiology"
    assert body["company"] == "Harborview Cardiology"

    # Profile is scoped to the lead, not a client.
    prof = db_session.query(models.CrmLeadProfile).filter(
        models.CrmLeadProfile.crm_leads_id == body["id"]
    ).first()
    assert prof is not None
    assert prof.clients_idclients is None


def test_create_without_contact_info_creates_no_profile(client, db_session):
    resp = client.post("/leads", json={"client_name": "No Contact Co"})
    assert resp.status_code == 201
    lead_id = resp.json()["id"]
    prof = db_session.query(models.CrmLeadProfile).filter(
        models.CrmLeadProfile.crm_leads_id == lead_id
    ).first()
    assert prof is None


def test_create_with_unknown_client_id_404(client):
    resp = client.post("/leads", json={"client_id": 99999, "title": "x"})
    assert resp.status_code == 404


def test_create_without_caller_user_403(client, claims):
    # An authenticated token whose oid has no users row -> 403.
    claims["oid"] = "ghost-oid"
    resp = client.post("/leads", json={"client_name": "Ghosts Inc"})
    assert resp.status_code == 403


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_filter_by_status(client):
    client.post("/leads", json={"client_name": "Lead Co"})  # stays Lead
    b = client.post("/leads", json={"client_name": "Signed Co"}).json()
    client.patch(f"/leads/{b['id']}", json={"pipeline_status": "SOW Signed"})

    resp = client.get("/leads", params={"status": "Lead"})
    assert resp.status_code == 200
    statuses = {o["pipeline_status"] for o in resp.json()}
    assert statuses == {"Lead"}


def test_list_resolves_company_for_clientless_lead(client):
    client.post("/leads", json={"company": "Acme Labs", "email": "a@acme.test"})
    resp = client.get("/leads", params={"status": "Lead"})
    item = next(o for o in resp.json() if o["company"] == "Acme Labs")
    assert item["client_id"] is None
    assert item["client_name"] == "Acme Labs"
    assert item["client_type"] == "New"


# ── Detail ──────────────────────────────────────────────────────────────────────

def test_get_detail_404(client):
    assert client.get("/leads/424242").status_code == 404


def test_detail_includes_sub_entities(client, db_session):
    client_id, _ = make_client_with_entity(db_session)
    lead = client.post("/leads", json={"client_id": client_id, "title": "Study"}).json()

    resp = client.get(f"/leads/{lead['id']}")
    assert resp.status_code == 200
    body = resp.json()
    names = {e["name"] for e in body["sub_entities"]}
    assert "Acme Health, PC" in names


# ── Update / status transitions ─────────────────────────────────────────────────

def test_patch_sow_signed_sets_timestamp_idempotently(client):
    lead = client.post("/leads", json={"client_name": "Transition Co"}).json()

    r1 = client.patch(f"/leads/{lead['id']}", json={"pipeline_status": "SOW Signed"})
    assert r1.status_code == 200
    first_ts = r1.json()["sow_signed_at"]
    assert first_ts is not None

    # A later unrelated patch must not overwrite the original signature time.
    r2 = client.patch(f"/leads/{lead['id']}", json={"title": "renamed"})
    assert r2.json()["sow_signed_at"] == first_ts


def test_patch_contact_fields_write_to_profile(client, db_session):
    lead = client.post("/leads", json={"company": "Initial"}).json()
    resp = client.patch(
        f"/leads/{lead['id']}",
        json={"company": "Updated Co", "email": "new@co.test", "phone": "+1-555-0000"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["company"] == "Updated Co"
    assert body["email"] == "new@co.test"
    assert body["phone"] == "+1-555-0000"


# ── Delete ──────────────────────────────────────────────────────────────────────

def test_delete_lead_keeps_client(client, db_session):
    lead = client.post("/leads", json={"client_name": "Keep Me Co"}).json()
    client_id = lead["client_id"]

    assert client.delete(f"/leads/{lead['id']}").status_code == 204
    assert client.get(f"/leads/{lead['id']}").status_code == 404
    # The account survives the lead deletion.
    assert db_session.query(models.Client).filter(
        models.Client.idclients == client_id
    ).first() is not None


# ── Calculations ────────────────────────────────────────────────────────────────

def test_create_calculation_sums_total_and_advances_status(client):
    lead = client.post("/leads", json={"client_name": "Calc Co"}).json()
    assert lead["pipeline_status"] == "Lead"

    resp = client.post(
        f"/leads/{lead['id']}/calculations",
        json={
            "tax_year": 2024,
            "tax_filing_status": "S Corporation",
            "entities": [
                {"entity_name": "Calc Co, PC", "grand_total": 100.0},
                {"entity_name": "Calc Co Imaging", "grand_total": 50.0},
            ],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["total_bill"] == 150.0
    assert body["entity_count"] == 2

    # A fresh Lead is moved to "Calculation Sent".
    detail = client.get(f"/leads/{lead['id']}").json()
    assert detail["pipeline_status"] == "Calculation Sent"
    assert detail["latest_calc_total"] == 150.0


def test_delete_calculation(client):
    lead = client.post("/leads", json={"client_name": "Del Calc Co"}).json()
    calc = client.post(
        f"/leads/{lead['id']}/calculations",
        json={"tax_year": 2024, "entities": [{"entity_name": "E1", "grand_total": 10.0}]},
    ).json()
    assert client.delete(f"/calculations/{calc['id']}").status_code == 204
    assert client.delete(f"/calculations/{calc['id']}").status_code == 404


# ── Engagements + billing ─────────────────────────────────────────────────────

def test_create_engagement_requires_client_entity(client):
    # Clientless lead -> cannot create an engagement (no entity to attach).
    lead = client.post("/leads", json={"company": "No Entity Co"}).json()
    resp = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"type": "R&D Tax Credit", "status": "Active",
              "yearly_billing": [{"year": 2024, "billing_amount": 100.0}]},
    )
    assert resp.status_code == 400


def test_create_engagement_derives_dates_and_billing(client, db_session):
    client_id, _ = make_client_with_entity(db_session)
    lead = client.post("/leads", json={"client_id": client_id}).json()

    resp = client.post(
        f"/leads/{lead['id']}/engagements",
        json={
            "type": "R&D Tax Credit",
            "status": "Active",
            "phase": "Discovery",
            "yearly_billing": [
                {"year": 2023, "billing_amount": 100.0},
                {"year": 2024, "billing_amount": 200.0},
            ],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["start_date"] == "2023-01-01"
    assert body["end_date"] == "2024-12-31"
    assert {b["year"] for b in body["yearly_billing"]} == {2023, 2024}


def test_patch_engagement_replaces_billing(client, db_session):
    client_id, _ = make_client_with_entity(db_session)
    lead = client.post("/leads", json={"client_id": client_id}).json()
    eng = client.post(
        f"/leads/{lead['id']}/engagements",
        json={"yearly_billing": [{"year": 2023, "billing_amount": 100.0}]},
    ).json()

    # Replacing with the same year must not trip the UNIQUE(eng, year) constraint.
    resp = client.patch(
        f"/engagements/{eng['id']}",
        json={"yearly_billing": [
            {"year": 2023, "billing_amount": 111.0},
            {"year": 2025, "billing_amount": 222.0},
        ]},
    )
    assert resp.status_code == 200
    billing = {b["year"]: b["billing_amount"] for b in resp.json()["yearly_billing"]}
    assert billing == {2023: 111.0, 2025: 222.0}


# ── Follow-up calls ─────────────────────────────────────────────────────────────

def test_follow_up_call_crud(client):
    lead = client.post("/leads", json={"client_name": "Calls Co"}).json()

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
