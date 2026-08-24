# AI Visualizer

> Watch a real language model choose every word it writes, inside a map of everything it knows.
> Pause, rotate, and rewind any decision.

A website that makes a language model's word-by-word thinking visible. A real open-weight model
(`Qwen/Qwen2.5-0.5B-Instruct`) runs a genuine forward pass for every word it writes. Each step
renders two ways at once: lit inside a rotatable 3D map of all **151,665 tokens the model knows**,
positioned by a UMAP projection of its own embeddings — and a panel beside it showing the actual
numbers, the two linked so highlighting one highlights the other. Click any token, including ones
the model never considered, and it names itself. The whole run is recorded as it happens, so it can
be played, paused, sped up, slowed down, and scrubbed backwards.

**Nothing on screen is faked.** Every probability, attention weight and coordinate comes from a
real forward pass, and the legend states the limits as plainly as the features.

## Status

**Works end to end, locally.** Type a prompt, the model runs, and you watch it choose each word in
3D — the candidates it weighed, the earlier tokens it attended to, and the exact numbers behind
both. Playback is pausable, scrubbable and speed-controlled. Remaining: deploy it.

| Milestone | State |
|---|---|
| S0 · Scaffold | ✅ done |
| M0 · Meet the model (hands-on + attention gate) | ✅ done — gate passed |
| M1 · Proof of real numbers | ✅ done |
| M2 · Backend skeleton, schema freeze | ✅ done — schema frozen |
| M3 · Projection artifact | ✅ done — UMAP, 77.7% preservation |
| M4.1 · Scene, field, live layer, playback | ✅ done |
| M4.2 · Icon rail, panels, numbers panel, cross-highlighting | ✅ done |
| M5 · Live end to end | ✅ done |
| ~~M6 · Retrieval backend~~ | cut — see PROJECT_PLAN.md |
| ~~M7 · Retrieval → generation~~ | cut |
| M8 · Ship | not started — the finish line |

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
