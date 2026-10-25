"""Auth dependency shared across the API.

`get_current_user` is the seam the scenario endpoints plug into: they
`Depends(get_current_user)` and use `user.id` (a string) as the scenario's
`owner_id`. `CurrentUser` is the minimal shape those endpoints rely on — it is
what test overrides substitute for the real DB-backed user.
"""

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from ..db import get_session
from ..tables import User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


@dataclass(frozen=True)
class CurrentUser:
    """Minimal authenticated-user shape the scenario slice reads (`.id`)."""

    id: str


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise _credentials_error
    subject = payload.get("sub")
    if subject is None:
        raise _credentials_error
    user = session.get(User, subject)
    if user is None:
        raise _credentials_error
    return user
