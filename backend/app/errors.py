"""Cross-cutting error handling: a single, consistent error envelope.

Every error response the API returns has the shape:

    {"error": {"code": "<slug>", "message": <detail>}}

so the frontend can handle failures uniformly. Plain `HTTPException`s use the
code `http_error`; raise `ApiError` where the client needs a specific code.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("intrinsic")


class ApiError(StarletteHTTPException):
    """An HTTP error that carries its own machine-readable `code`."""

    def __init__(
        self, status_code: int, code: str, detail: object, headers: dict | None = None
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


def _envelope(code: str, message: object, *, status_code: int, headers=None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": jsonable_encoder(message)}},
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = exc.code if isinstance(exc, ApiError) else "http_error"
        return _envelope(code, exc.detail, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return _envelope("validation_error", exc.errors(), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _envelope("internal_error", "Internal server error", status_code=500)
