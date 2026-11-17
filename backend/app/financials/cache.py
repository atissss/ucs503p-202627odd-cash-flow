"""A small in-process TTL cache for provider lookups.

Entries are kept past their TTL (up to `max_entries`, least recently used
evicted first) so the service can still serve them as stale when the provider
fails. The lock makes it safe to share across FastAPI's worker threads.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class CacheEntry(Generic[T]):
    value: T
    stored_at: float
    ttl_seconds: float

    def age(self, now: float) -> float:
        return now - self.stored_at

    def is_fresh(self, now: float) -> bool:
        return self.age(now) < self.ttl_seconds


class TTLCache(Generic[T]):
    def __init__(self, max_entries: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._entries: OrderedDict[str, CacheEntry[T]] = OrderedDict()
        self._max_entries = max_entries
        self._lock = threading.Lock()
        self.clock = clock

    def get(self, key: str) -> CacheEntry[T] | None:
        """Return the entry for `key`, fresh or not, or None if absent."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None:
                self._entries.move_to_end(key)
            return entry

    def set(self, key: str, value: T, ttl_seconds: float) -> None:
        with self._lock:
            self._entries[key] = CacheEntry(value, self.clock(), ttl_seconds)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
