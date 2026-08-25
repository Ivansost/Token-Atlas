"""Small, testable access controls for the public inference endpoint.

These controls are intentionally host-agnostic. Modal still supplies the hard cost ceiling through
``max_containers``; this module prevents one browser or script from consuming that ceiling without
bound inside a running container.
"""

from __future__ import annotations

import math
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from typing import Iterable

LOCAL_ORIGINS = frozenset({"http://localhost:5173", "http://127.0.0.1:5173"})


def normalise_origins(origins: Iterable[str]) -> frozenset[str]:
    """Return exact browser origins with accidental trailing slashes removed."""
    return frozenset(origin.strip().rstrip("/") for origin in origins if origin.strip())


def origin_allowed(origin: str | None, allowed: Iterable[str]) -> bool:
    """WebSockets do not use CORS, so their ``Origin`` header must be checked explicitly."""
    if not origin:
        return False
    return origin.rstrip("/") in normalise_origins(allowed)


@dataclass(frozen=True)
class RateDecision:
    allowed: bool
    retry_after_seconds: int = 0


class SlidingWindowLimiter:
    """Per-client and process-wide run limits over one rolling time window.

    Calls happen on the FastAPI event loop with no ``await`` inside this method, so each check and
    record is atomic within the process. The global window also limits clients that rotate their
    apparent address; Modal's ``max_containers`` remains the cross-process spending ceiling.
    """

    def __init__(
        self,
        *,
        client_limit: int,
        global_limit: int,
        window_seconds: float,
        max_tracked_clients: int = 2048,
    ) -> None:
        if min(client_limit, global_limit, max_tracked_clients) < 1 or window_seconds <= 0:
            raise ValueError("rate-limit values must be positive")
        self.client_limit = client_limit
        self.global_limit = global_limit
        self.window_seconds = window_seconds
        self.max_tracked_clients = max_tracked_clients
        self._global: deque[float] = deque()
        self._clients: OrderedDict[str, deque[float]] = OrderedDict()

    def check(self, client: str, *, now: float | None = None) -> RateDecision:
        timestamp = time.monotonic() if now is None else now
        cutoff = timestamp - self.window_seconds
        self._prune(self._global, cutoff)

        history = self._clients.get(client)
        if history is None:
            if len(self._clients) >= self.max_tracked_clients:
                self._discard_stale_clients(cutoff)
            if len(self._clients) >= self.max_tracked_clients:
                self._clients.popitem(last=False)
            history = deque()
            self._clients[client] = history
        else:
            self._clients.move_to_end(client)
        self._prune(history, cutoff)

        blocked_until: list[float] = []
        if len(history) >= self.client_limit:
            blocked_until.append(history[0] + self.window_seconds)
        if len(self._global) >= self.global_limit:
            blocked_until.append(self._global[0] + self.window_seconds)
        if blocked_until:
            retry_after = max(1, math.ceil(max(blocked_until) - timestamp))
            return RateDecision(False, retry_after)

        history.append(timestamp)
        self._global.append(timestamp)
        return RateDecision(True)

    @staticmethod
    def _prune(history: deque[float], cutoff: float) -> None:
        while history and history[0] <= cutoff:
            history.popleft()

    def _discard_stale_clients(self, cutoff: float) -> None:
        for client, history in list(self._clients.items()):
            self._prune(history, cutoff)
            if not history:
                del self._clients[client]
