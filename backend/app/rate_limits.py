from __future__ import annotations

import logging
import os
import threading
import time
from collections import OrderedDict, deque

from redis import Redis
from redis.exceptions import RedisError


logger = logging.getLogger(__name__)
_INCREMENT_WINDOW = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {current, redis.call('TTL', KEYS[1])}
"""


class RateLimiter:
    """Shared fixed-window limiter with a bounded local fallback."""

    def __init__(self) -> None:
        url = os.getenv("REDIS_URL", "")
        self._redis = Redis.from_url(
            url,
            decode_responses=True,
            max_connections=32,
            socket_connect_timeout=0.4,
            socket_timeout=0.4,
            health_check_interval=30,
        ) if url else None
        self._fallback: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_keys = 10_000
        self._redis_available = True

    def consume(self, key: str, limit: int, window_seconds: int) -> bool:
        if self._redis:
            try:
                count, _ttl = self._redis.eval(_INCREMENT_WINDOW, 1, f"labcentral:limit:{key}", window_seconds)
                if not self._redis_available:
                    logger.info("Rate limiter Redis recuperado")
                    self._redis_available = True
                return int(count) <= limit
            except RedisError:
                if self._redis_available:
                    logger.warning("Rate limiter Redis no disponible; se activa el límite local por proceso")
                    self._redis_available = False
        return self._consume_local(key, limit, window_seconds)

    def close(self) -> None:
        if self._redis:
            self._redis.close()

    def _consume_local(self, key: str, limit: int, window_seconds: int) -> bool:
        now = time.monotonic()
        with self._lock:
            bucket = self._fallback.pop(key, deque())
            while bucket and now - bucket[0] >= window_seconds:
                bucket.popleft()
            allowed = len(bucket) < limit
            if allowed:
                bucket.append(now)
            self._fallback[key] = bucket
            while len(self._fallback) > self._max_keys:
                self._fallback.popitem(last=False)
            return allowed


rate_limiter = RateLimiter()
