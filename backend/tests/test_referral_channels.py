"""Tests for the read-only referral channels lookup API."""

from app import models


def _add_channel(db_session, name: str, description=None) -> int:
    ch = models.ReferralChannel(channel_name=name, description=description)
    db_session.add(ch)
    db_session.commit()
    return ch.id


def test_list_returns_channels_sorted(client, db_session):
    _add_channel(db_session, "Seminar")
    _add_channel(db_session, "CPA Partner", description="Referred by a CPA firm")
    _add_channel(db_session, "Client Referral")

    resp = client.get("/referral-channels")
    assert resp.status_code == 200
    body = resp.json()
    names = [c["channel_name"] for c in body]
    assert names == ["CPA Partner", "Client Referral", "Seminar"]  # channel_name asc
    cpa = next(c for c in body if c["channel_name"] == "CPA Partner")
    assert cpa["description"] == "Referred by a CPA firm"


def test_list_empty(client, db_session):
    resp = client.get("/referral-channels")
    assert resp.status_code == 200
    assert resp.json() == []
