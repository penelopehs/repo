"""Tests for the read-only clients API (list + client_name search)."""

from app import models


def _add_client(db_session, name: str) -> int:
    c = models.Client(client_name=name, client_status_idclient_status=1, created_by=1)
    db_session.add(c)
    db_session.commit()
    return c.idclients


def test_list_returns_all_clients_sorted(client, db_session):
    _add_client(db_session, "Beacon Health")
    _add_client(db_session, "Acme Labs")

    resp = client.get("/clients")
    assert resp.status_code == 200
    names = [c["client_name"] for c in resp.json()]
    assert names == ["Acme Labs", "Beacon Health"]  # ordered by client_name asc


def test_search_matches_substring_case_insensitively(client, db_session):
    _add_client(db_session, "Cedar Valley Medical")
    _add_client(db_session, "Summit Orthopedics")
    _add_client(db_session, "Lakeside Dental")

    resp = client.get("/clients", params={"name": "val"})
    assert resp.status_code == 200
    names = {c["client_name"] for c in resp.json()}
    assert names == {"Cedar Valley Medical"}


def test_search_no_match_returns_empty(client, db_session):
    _add_client(db_session, "Acme Labs")
    resp = client.get("/clients", params={"name": "zzz"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_blank_search_returns_all(client, db_session):
    _add_client(db_session, "Acme Labs")
    _add_client(db_session, "Beacon Health")
    resp = client.get("/clients", params={"name": "   "})
    assert resp.status_code == 200
    assert len(resp.json()) == 2
