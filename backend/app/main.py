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
from typing import Any, Iterator, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import events
from .decode import MAX_NEW_TOKENS, generate_steps
from .model import MODEL_ID, is_loaded

MAX_PROMPT_CHARS = 500
MAX_TOKENS_CEILING = 120

app = FastAPI(title="AI Visualizer")

# The Vite dev server runs on a different port, so the browser treats it as cross-origin.
# Tightened to the deployed frontend origin at M8.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    """Lets the frontend show an honest loading state during the ~27s cold start."""
    return {"ok": True, "model": MODEL_ID, "loaded": is_loaded()}


def _next(gen: Iterator[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """next() with a sentinel -- StopIteration does not travel across a thread boundary cleanly."""
    return next(gen, None)


@app.websocket("/ws")
async def ws_generate(ws: WebSocket) -> None:
    await ws.accept()
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

            # Generation is synchronous CPU work. Stepping it in a worker thread keeps the event
            # loop free, so a second connection is not blocked by the first one's run.
            gen = generate_steps(prompt, max_new_tokens=max_tokens)
            while True:
                event = await asyncio.to_thread(_next, gen)
                if event is None:
                    break
                await ws.send_json(event)

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 -- never kill the socket without telling the client
        try:
            await ws.send_json(events.error_event(f"{type(exc).__name__}: {exc}"))
        except Exception:
            pass
