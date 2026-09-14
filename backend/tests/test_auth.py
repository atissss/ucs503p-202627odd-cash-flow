"""Tests for the auth slice: register, login, the /me dependency, and the
consistent error envelope."""

EMAIL = "analyst@example.com"
PASSWORD = "password123"


def _register(client, email=EMAIL, password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def _login(client, email=EMAIL, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_register_login_and_me(client):
    res = _register(client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == EMAIL
    assert "id" in body
    assert "hashed_password" not in body  # never leak the hash

    token = _login(client).json()["access_token"]
    assert token

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == EMAIL


def test_duplicate_email_rejected(client):
    assert _register(client).status_code == 201
    assert _register(client).status_code == 409


def test_login_wrong_password(client):
    _register(client)
    res = _login(client, password="not-the-password")
    assert res.status_code == 401


def test_me_requires_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_error_envelope_shape(client):
    body = client.get("/api/auth/me").json()
    assert "error" in body
    assert body["error"]["code"] == "http_error"


def test_short_password_is_validation_error(client):
    res = client.post("/api/auth/register", json={"email": EMAIL, "password": "short"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
