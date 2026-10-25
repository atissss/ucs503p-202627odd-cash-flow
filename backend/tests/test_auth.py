"""Tests for the auth slice: register, login, the /me dependency, and the
consistent error envelope. Uses `auth_client` (the real auth dependency)."""

EMAIL = "analyst@example.com"
PASSWORD = "password123"


def _register(client, email=EMAIL, password=PASSWORD):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def _login(client, email=EMAIL, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_register_login_and_me(auth_client):
    res = _register(auth_client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == EMAIL
    assert "id" in body
    assert "hashed_password" not in body  # never leak the hash

    token = _login(auth_client).json()["access_token"]
    assert token

    res = auth_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == EMAIL


def test_duplicate_email_rejected(auth_client):
    assert _register(auth_client).status_code == 201
    assert _register(auth_client).status_code == 409


def test_login_wrong_password(auth_client):
    _register(auth_client)
    res = _login(auth_client, password="not-the-password")
    assert res.status_code == 401


def test_me_requires_token(auth_client):
    res = auth_client.get("/api/auth/me")
    assert res.status_code == 401


def test_error_envelope_shape(auth_client):
    body = auth_client.get("/api/auth/me").json()
    assert "error" in body
    assert body["error"]["code"] == "http_error"


def test_short_password_is_validation_error(auth_client):
    res = auth_client.post("/api/auth/register", json={"email": EMAIL, "password": "short"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"
