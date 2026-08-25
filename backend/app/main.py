"""FastAPI app. One health endpoint, one WebSocket, nothing else.

    uvicorn app.main:app --reload --port 8000     (run from the backend/ directory)

The WebSocket protocol is deliberately tiny:

    client sends  {"prompt": "What is the capital of France?", "max_tokens": 60}
    server sends  {"type": "step", ...} x N, then {"type": "done", ...}
                  or {"type": "error", "message": "..."}

Events are pushed as fast as the model produces them -- ~32 tok/s, so a full run lands in about
two seconds. The frontend does NOT render them as they arrive: it appends to a steps[] array and a
separate playback controller walks an index through it. That decoupling is what makes pause,
speed, and scrub-backwards possible, and after the M0 speed measurement it is also the only thing
that makes the run watchable at all.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Iterator, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from . import events
from .access import LOCAL_ORIGINS, SlidingWindowLimiter, normalise_origins, origin_allowed
from .decode import generate_steps
from .model import MODEL_ID, is_loaded
from .protocol import RequestValidationError, parse_generation_request

logger = logging.getLogger(__name__)

# --- limits, because this endpoint runs a model for anyone who asks -------------------------
#
# A public URL that performs inference on demand is the one genuinely abusable thing here. There
# is no login and no cost ceiling on the host, so an unthrottled endpoint lets one visitor pin the
# CPU indefinitely and, on a metered host, spend real money.
#
# One generation at a time, process-wide. The container has one model in one process; running two
# at once does not double throughput, it halves both and doubles the latency everyone sees.
MAX_CONCURRENT_RUNS = 1
# How many may wait behind the one running. Beyond this, say so instead of queueing silently --
# a visitor staring at nothing cannot tell a queue from a crash.
MAX_QUEUED_RUNS = 3
# Minimum gap between accepted runs on a single connection, in addition to the rolling client and
# process limits below.
MIN_SECONDS_BETWEEN_RUNS = 1.5
RATE_WINDOW_SECONDS = float(os.environ.get("RATE_WINDOW_SECONDS", "60"))
MAX_RUNS_PER_CLIENT_WINDOW = int(os.environ.get("MAX_RUNS_PER_CLIENT_WINDOW", "6"))
MAX_RUNS_GLOBAL_WINDOW = int(os.environ.get("MAX_RUNS_GLOBAL_WINDOW", "24"))
# Deliberately generous, and 3 was measurably wrong.
#
# Behind Modal's proxy a client disconnect does not reach the ASGI app promptly -- the server task
# stays parked in `receive_json` until the 300s input timeout, so a closed connection keeps being
# counted as active for up to five minutes. At 3, that meant one visitor who reloaded the page
# three times, or whose socket dropped and hit the frontend's reconnect backoff, was locked out of
# their own demo for the next five minutes. Measured against the deployment, not guessed.
#
# The real abuse control is the sliding window below: it is time-based and therefore self-healing,
# whereas a connection cap interacting with delayed disconnects is not. This cap exists only to
# stop a single client opening an unbounded number of sockets, so it is set to match the
# container's own concurrency ceiling rather than trying to be clever.
MAX_CONNECTIONS_PER_CLIENT = int(os.environ.get("MAX_CONNECTIONS_PER_CLIENT", "8"))

_slot = asyncio.Semaphore(MAX_CONCURRENT_RUNS)
_waiting = 0
_active_connections: dict[str, int] = {}
_run_limiter = SlidingWindowLimiter(
    client_limit=MAX_RUNS_PER_CLIENT_WINDOW,
    global_limit=MAX_RUNS_GLOBAL_WINDOW,
    window_seconds=RATE_WINDOW_SECONDS,
)

app = FastAPI(title="Token Atlas")

# The Vite dev server runs on a different port, so the browser treats it as cross-origin.
# ALLOWED_ORIGINS is set to the deployed frontend at M8; localhost stays for development.
_origins = normalise_origins(os.environ.get("ALLOWED_ORIGINS", "").split(","))
_allowed_origins = _origins | LOCAL_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_allowed_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    """Lets the frontend show an honest loading state during the ~27s cold start."""
    return {
        "ok": True,
        "model": MODEL_ID,
        "loaded": is_loaded(),
        "busy": _waiting > 0,
    }


def _next(gen: Iterator[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """next() with a sentinel -- StopIteration does not travel across a thread boundary cleanly."""
    return next(gen, None)


def _client_key(ws: WebSocket) -> str:
    """Use the proxy-provided address when present, falling back to the ASGI peer."""
    forwarded = ws.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:128] or "unknown"
    return (ws.client.host if ws.client else "unknown")[:128]


@app.websocket("/ws")
async def ws_generate(ws: WebSocket) -> None:
    # ACCEPT FIRST, THEN REFUSE. This ordering is load-bearing and counter-intuitive.
    #
    # Closing before accepting is the textbook way to refuse a WebSocket, and behind Modal it is
    # actively harmful. Modal's proxy completes the handshake at the edge before the ASGI app is
    # reached, so a close-before-accept never terminates the server task: it hangs until Modal's
    # 300-second input timeout while the browser reports "a broken close frame containing a
    # reserved status code". Each refusal therefore pins one of the container's concurrency slots
    # for five minutes, and since the app runs 2 containers x 8 inputs, a burst of ~16 refusals
    # takes the endpoint down for everybody -- refusals becoming the outage they exist to prevent.
    #
    # This was measured in production, not reasoned about: the deployed logs showed
    # "CONNECT /ws -> 101 Switching Protocols (duration: 300.0 s)" once per refused connection,
    # and every subsequent client received HTTP 403 until the slots drained.
    #
    # Accepting costs nothing here. No prompt is read and no model work is scheduled before the
    # checks below, so an unauthorised caller still gets a socket that closes immediately.
    await ws.accept()

    if not origin_allowed(ws.headers.get("origin"), _allowed_origins):
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    client = _client_key(ws)
    active = _active_connections.get(client, 0)
    if active >= MAX_CONNECTIONS_PER_CLIENT:
        await ws.close(code=status.WS_1013_TRY_AGAIN_LATER)
        return

    _active_connections[client] = active + 1
    try:
        last_run = 0.0
        while True:
            try:
                payload = await ws.receive_json()
                request = parse_generation_request(payload)
            except RequestValidationError as exc:
                await ws.send_json(events.error_event(str(exc)))
                continue
            except json.JSONDecodeError:
                await ws.send_json(events.error_event("Request must be valid JSON."))
                continue

            now = time.monotonic()
            if now - last_run < MIN_SECONDS_BETWEEN_RUNS:
                await ws.send_json(events.error_event("Slow down a moment, then try again."))
                continue

            global _waiting
            if _waiting >= MAX_CONCURRENT_RUNS + MAX_QUEUED_RUNS:
                await ws.send_json(events.error_event(
                    "The model is busy with other visitors. Try again in a few seconds."
                ))
                continue

            decision = _run_limiter.check(client, now=now)
            if not decision.allowed:
                await ws.send_json(events.error_event(
                    f"Too many runs. Try again in {decision.retry_after_seconds} seconds."
                ))
                continue

            last_run = now
            _waiting += 1
            try:
                async with _slot:
                    # Generation is synchronous CPU work. Stepping it in a worker thread keeps the
                    # event loop free, so health checks and other sockets stay responsive while
                    # this one generates.
                    gen = generate_steps(request.prompt, max_new_tokens=request.max_tokens)
                    while True:
                        event = await asyncio.to_thread(_next, gen)
                        if event is None:
                            break
                        await ws.send_json(event)
            except WebSocketDisconnect:
                raise
            except Exception:  # noqa: BLE001 -- generation failures are logged, never exposed
                logger.exception("generation failed")
                await ws.send_json(events.error_event(
                    "The model hit an unexpected error. Please try again."
                ))
            finally:
                _waiting -= 1

    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001 -- never kill the socket without logging the reason
        logger.exception("websocket failed")
        try:
            await ws.send_json(events.error_event("The connection closed unexpectedly. Reconnecting…"))
        except Exception:
            pass
    finally:
        remaining = _active_connections.get(client, 1) - 1
        if remaining > 0:
            _active_connections[client] = remaining
        else:
            _active_connections.pop(client, None)
