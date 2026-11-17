"""Failures of a ticker lookup. Messages are safe to show to the user.

Every one of these means "no usable live data": the UI falls back to manual
entry. The router maps each class to an HTTP status and error code.
"""

from __future__ import annotations


class FinancialsError(Exception):
    """Base class for ticker-lookup failures."""


class InvalidTickerError(FinancialsError):
    """The ticker is not a well-formed symbol, so the provider is never asked."""


class TickerNotFoundError(FinancialsError):
    """The provider has no statements for this ticker."""


class TickerNotCoveredError(FinancialsError):
    """The provider knows the ticker, but our plan does not cover it."""


class ProviderError(FinancialsError):
    """The provider failed, or answered in a shape we cannot read."""


class ProviderNotConfiguredError(ProviderError):
    """No FMP key is set, so lookups are disabled."""


class RateLimitedError(ProviderError):
    """The provider's rate limit is exhausted; retry after `retry_after` seconds."""

    def __init__(self, message: str, retry_after: int) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class InvalidDataError(FinancialsError):
    """The provider answered, but the figures failed validation."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("Provider data failed validation: " + "; ".join(problems))
        self.problems = problems
