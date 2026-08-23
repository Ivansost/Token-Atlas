# AI Visualizer

> Watch a real local model search its evidence and generate an answer, one token at a time.
> Pause, rotate, and rewind the entire run.

A website that makes an AI's word-by-word thinking visible. A real open-weight model
(`Qwen/Qwen2.5-0.5B-Instruct`) runs a genuine forward pass for every word it writes. Each step
renders two ways at once: a rotatable 3D cloud of the tokens it *considered*, sized by how likely
it thought each one was, with lines back to the earlier tokens its attention weighted most heavily
— and a panel beside it showing the actual numbers, linked so highlighting one highlights the
other. The whole run is recorded as it happens, so it can be played, paused, sped up, slowed down,
and scrubbed backwards. Before it writes, it searches a real document corpus, shown as a galaxy of
chunks that light up and rank themselves, with the winners feeding into the same generation engine.

**Nothing on screen is faked.** Every probability, attention weight, and retrieval score comes from
a real forward pass through a real model.

## Status

**Backend complete and working locally.** A real model runs, streams one event per generated token
over a WebSocket, and every token has a fixed 3D position derived from the model's own embeddings.
No frontend yet — that starts at M4.

| Milestone | State |
|---|---|
| S0 · Scaffold | ✅ done |
| M0 · Meet the model (hands-on + attention gate) | ✅ done — gate passed |
| M1 · Proof of real numbers | ✅ done |
| M2 · Backend skeleton, schema freeze | ✅ done — schema frozen |
| M3 · Projection artifact | ✅ done — UMAP, 77.7% preservation |
| M4.1 · Scene, field, live layer, playback | ✅ done |
| M4.2 · Icon rail, panels, numbers panel, cross-highlighting | in progress — design pass done |
| M5 · Phase 1 complete (deployable) | not started |
| M6 · Retrieval backend | not started |
| M7 · Retrieval → generation transition | not started |
| M8 · Ship | not started |

## Documentation

| File | What it is |
|---|---|
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | **The file we build against.** Milestones, locked decisions, tech stack, data contract, risk register |
| [`PROJECT_IDEA.md`](PROJECT_IDEA.md) | Background: the idea, competitive research, decision history, learning curriculum, technical appendices |
| `MODEL_NOTES.md` | Written at M0: measured speed, model quirks, prompts that work |

## Running it locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

The first model load downloads ~1 GB into `~/.cache/huggingface/hub`, once. Everything runs on CPU.

**Watch a full generation in the terminal** — every step's candidates, probabilities, and attention.
This is the model-side debugger; check backend changes here before checking them in a browser.

```bash
./.venv/bin/python backend/scripts/run_local.py "What is the capital of France?"
```

**Run the server:**

```bash
cd backend && ../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

`GET /health` reports whether the model is loaded. `WS /ws` takes
`{"prompt": "...", "max_tokens": 60}` and streams `step` events followed by `done`.

**Other tools:** `chat.py` (talk to it), `tokens.py` (see tokenization), `probe.py` (one step's
numbers in detail).
