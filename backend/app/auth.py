"""Authentication dependency — TEMPORARY development stub.

Person 2 owns the users/auth slice and will provide the real `User` model and a
`get_current_user()` FastAPI dependency. Until that lands, this stub returns a
fixed dev user so the scenario endpoints can be built and tested end to end.

Everything auth-related is imported from THIS module so the swap to Person 2's
implementation is a one-line change here (re-export their dependency) rather
than an edit scattered across every router.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CurrentUser:
    """Minimal shape the scenario slice needs from the authenticated user.

    Person 2's real `User` will have more fields; the scenario code only ever
    reads `.id`, so this stays compatible as long as their model exposes `id`.
    """

    id: str


# Fixed identity used for every request while auth is stubbed. UUID-shaped so it
# stays compatible if Person 2's `User.id` is a string UUID.
_DEV_USER = CurrentUser(id="00000000-0000-0000-0000-000000000001")


# TODO: replace with Person 2's auth dependency.
# When their slice lands, delete the stub above and re-export their dependency,
# e.g. `from .users.auth import get_current_user`, keeping this module the single
# import site for the scenario routers.
def get_current_user() -> CurrentUser:
    """Return the current authenticated user (dev stub: a fixed user)."""
    return _DEV_USER
