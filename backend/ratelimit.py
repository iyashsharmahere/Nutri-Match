"""Small in-memory sliding-window rate limiter.

Fine for a single-process deployment (free-tier hosting, demos). For several
workers/instances, enforce limits at the proxy or move the counters to Redis.
"""
import time
from collections import deque


class RateLimiter:
    def __init__(self, limit: int, window_s: float = 60.0, max_clients: int = 10_000, clock=time.monotonic):
        self.limit, self.window, self.max_clients, self.clock = limit, window_s, max_clients, clock
        self._hits: dict[str, deque] = {}

    def check(self, key: str) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        if self.limit <= 0:
            return True, 0
        now = self.clock()
        q = self._hits.get(key)
        if q is None:
            if len(self._hits) >= self.max_clients:
                self._evict(now)
            q = self._hits[key] = deque()
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False, max(1, int(self.window - (now - q[0])) + 1)
        q.append(now)
        return True, 0

    def _evict(self, now: float):
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] >= self.window]
        for k in stale:
            del self._hits[k]
        if len(self._hits) >= self.max_clients:  # still full: drop oldest-inserted
            for k in list(self._hits)[: self.max_clients // 10]:
                del self._hits[k]
