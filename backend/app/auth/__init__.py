"""Authentication slice: user accounts, password hashing, and JWT sessions.

Re-exports the single seam the scenario slice depends on, so its routers/tests
`from app.auth import CurrentUser, get_current_user` regardless of internals.
"""

from .deps import CurrentUser, get_current_user

__all__ = ["CurrentUser", "get_current_user"]
