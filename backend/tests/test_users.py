"""Tests for the /users router (provisioning + listing)."""

from app import models


def test_users_me_returns_existing_caller(client):
    # conftest seeds a users row for CALLER_OID; /users/me should return it
    # rather than creating a duplicate.
    resp = client.get("/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["azure_ad_user_id"] == "caller-oid"
    assert body["email"] == "caller@test.local"


def test_users_me_provisions_new_user(client, claims, db_session):
    # A token for an oid with no users row yet should provision one from claims.
    claims["oid"] = "brand-new-oid"
    claims["preferred_username"] = "newbie@test.local"
    claims["given_name"] = "Nina"
    claims["family_name"] = "Newbie"

    resp = client.get("/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["azure_ad_user_id"] == "brand-new-oid"
    assert body["first_name"] == "Nina"
    assert body["last_name"] == "Newbie"
    assert body["email"] == "newbie@test.local"

    # Persisted exactly once.
    rows = (
        db_session.query(models.User)
        .filter(models.User.azure_ad_user_id == "brand-new-oid")
        .all()
    )
    assert len(rows) == 1


def test_users_me_name_fallback_splits_display_name(client, claims):
    # No given/family name, only a display name -> split into first/last.
    claims["oid"] = "split-oid"
    claims.pop("given_name", None)
    claims.pop("family_name", None)
    claims["name"] = "Grace Hopper"
    claims["preferred_username"] = "grace@test.local"

    resp = client.get("/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["first_name"] == "Grace"
    assert body["last_name"] == "Hopper"


def test_users_me_missing_oid_returns_400(client, claims):
    claims.pop("oid", None)
    resp = client.get("/users/me")
    assert resp.status_code == 400


def test_list_users(client):
    resp = client.get("/users/")
    assert resp.status_code == 200
    emails = {u["email"] for u in resp.json()}
    assert "caller@test.local" in emails


def test_requires_authentication(client):
    # Drop the auth override: HTTPBearer(auto_error=True) rejects the request
    # before verify_token runs, so no Azure call is made.
    from app.auth import verify_token
    from app.main import app

    app.dependency_overrides.pop(verify_token, None)
    resp = client.get("/users/")
    assert resp.status_code in (401, 403)
