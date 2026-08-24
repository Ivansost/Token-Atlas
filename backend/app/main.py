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
import os
import time
from typing import Any, Iterator, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import events
from .decode import MAX_NEW_TOKENS, generate_steps
from .model import MODEL_ID, is_loaded

MAX_PROMPT_CHARS = 500
MAX_TOKENS_CEILING = 120

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
# Minimum gap between runs on a single connection. Generous for a human clicking Run, useless for
# a script.
MIN_SECONDS_BETWEEN_RUNS = 1.5

_slot = asyncio.Semaphore(MAX_CONCURRENT_RUNS)
_waiting = 0

app = FastAPI(title="AI Visualizer")

# The Vite dev server runs on a different port, so the browser treats it as cross-origin.
# ALLOWED_ORIGINS is set to the deployed frontend at M8; localhost stays for development.
_origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins + ["http://localhost:5173", "http://127.0.0.1:5173"],
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


@app.websocket("/ws")
async def ws_generate(ws: WebSocket) -> None:
    await ws.accept()
    last_run = 0.0
    try:
        while True:
            request = await ws.receive_json()

            prompt = str(request.get("prompt", "")).strip()
            if not prompt:
                await ws.send_json(events.error_event("empty prompt"))
                continue
            if len(prompt) > MAX_PROMPT_CHARS:
                await ws.send_json(
                    events.error_event(f"prompt too long (max {MAX_PROMPT_CHARS} characters)")
                )
                continue

            max_tokens = min(int(request.get("max_tokens", MAX_NEW_TOKENS)), MAX_TOKENS_CEILING)

            now = time.monotonic()
            if now - last_run < MIN_SECONDS_BETWEEN_RUNS:
                await ws.send_json(events.error_event("Slow down a moment, then try again."))
                continue
            last_run = now

            global _waiting
            if _waiting >= MAX_QUEUED_RUNS:
                await ws.send_json(events.error_event(
                    "The model is busy with other visitors. Try again in a few seconds."
                ))
                continue

            _waiting += 1
            try:
                async with _slot:
                    # Generation is synchronous CPU work. Stepping it in a worker thread keeps the
                    # event loop free, so health checks and other sockets stay responsive while
                    # this one generates.
                    gen = generate_steps(prompt, max_new_tokens=max_tokens)
                    while True:
                        event = await asyncio.to_thread(_next, gen)
                        if event is None:
                            break
                        await ws.send_json(event)
            finally:
                _waiting -= 1

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 -- never kill the socket without telling the client
        try:
            await ws.send_json(events.error_event(f"{type(exc).__name__}: {exc}"))
        except Exception:
            pass
