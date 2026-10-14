from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from contextlib import suppress

from fastapi import WebSocket
from redis.asyncio import Redis
from redis.exceptions import RedisError


logger = logging.getLogger(__name__)


class EventStream:
    """Broadcast small invalidation messages locally and across app workers."""

    def __init__(self) -> None:
        self.redis_url = os.getenv("REDIS_URL", "")
        self._redis: Redis | None = None
        self._pubsub = None
        self._listener: asyncio.Task | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._redis_available = True
        self._sockets: dict[int, dict[WebSocket, asyncio.Queue[dict]]] = defaultdict(dict)
        self._writers: dict[WebSocket, asyncio.Task] = {}

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        if not self.redis_url:
            logger.warning("REDIS_URL no configurado; realtime limitado a un proceso")
            return
        self._redis = Redis.from_url(
            self.redis_url,
            decode_responses=True,
            max_connections=32,
            socket_connect_timeout=1,
            socket_keepalive=True,
            health_check_interval=30,
        )
        self._listener = asyncio.create_task(self._listen(), name="labcentral-event-listener")

    async def stop(self) -> None:
        if self._listener:
            self._listener.cancel()
            with suppress(asyncio.CancelledError):
                await self._listener
        if self._pubsub:
            with suppress(RedisError):
                await self._pubsub.aclose()
            self._pubsub = None
        if self._redis:
            with suppress(RedisError):
                await self._redis.aclose()
            self._redis = None
        for task in tuple(self._writers.values()):
            task.cancel()
        if self._writers:
            await asyncio.gather(*self._writers.values(), return_exceptions=True)
        self._writers.clear()
        self._sockets.clear()

    async def publish(self, event_id: int, message: dict) -> None:
        payload = json.dumps(message, separators=(",", ":"))
        if self._redis:
            try:
                await asyncio.wait_for(self._redis.publish(self._channel(event_id), payload), timeout=2)
                self._redis_available = True
                return
            except (RedisError, TimeoutError):
                if self._redis_available:
                    logger.warning("No se pudo publicar el evento realtime en Redis; se usará el proceso local")
                    self._redis_available = False
        await self._dispatch(event_id, message)

    def publish_from_thread(self, event_id: int, message: dict) -> None:
        loop = self._loop
        if not loop or loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(self.publish(event_id, message), loop)

    async def subscribe(self, event_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=16)
        self._sockets[event_id][websocket] = queue
        self._writers[websocket] = asyncio.create_task(self._write_socket(websocket, queue))

    async def unsubscribe(self, event_id: int, websocket: WebSocket) -> None:
        self._sockets[event_id].pop(websocket, None)
        if not self._sockets[event_id]:
            self._sockets.pop(event_id, None)
        task = self._writers.pop(websocket, None)
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    async def _write_socket(self, websocket: WebSocket, queue: asyncio.Queue[dict]) -> None:
        try:
            while True:
                await websocket.send_json(await queue.get())
        except Exception:
            # The connection handler removes failed sockets on disconnect.
            return

    async def _dispatch(self, event_id: int, message: dict) -> None:
        for queue in tuple(self._sockets.get(event_id, {}).values()):
            if queue.full():
                with suppress(asyncio.QueueEmpty):
                    queue.get_nowait()
            with suppress(asyncio.QueueFull):
                queue.put_nowait(message)

    async def _listen(self) -> None:
        delay = 0.5
        while True:
            try:
                self._pubsub = self._redis.pubsub()
                await self._pubsub.psubscribe("labcentral:events:*")
                self._redis_available = True
                delay = 0.5
                async for item in self._pubsub.listen():
                    if item.get("type") != "pmessage":
                        continue
                    try:
                        event_id = int(str(item["channel"]).rsplit(":", 1)[1])
                        message = json.loads(item["data"])
                    except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                        continue
                    await self._dispatch(event_id, message)
            except asyncio.CancelledError:
                raise
            except RedisError:
                logger.warning("Canal realtime desconectado; reintentando")
                self._redis_available = False
                if self._pubsub:
                    with suppress(RedisError):
                        await self._pubsub.aclose()
                    self._pubsub = None
                await asyncio.sleep(delay)
                delay = min(delay * 2, 15)
            except Exception:
                logger.exception("Error inesperado en el canal realtime; reintentando")
                if self._pubsub:
                    with suppress(Exception):
                        await self._pubsub.aclose()
                    self._pubsub = None
                await asyncio.sleep(delay)
                delay = min(delay * 2, 15)

    @staticmethod
    def _channel(event_id: int) -> str:
        return f"labcentral:events:{event_id}"


event_stream = EventStream()
