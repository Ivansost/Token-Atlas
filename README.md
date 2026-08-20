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

Pre-build. Scaffolding only — no model code yet.

| Milestone | State |
|---|---|
| S0 · Scaffold | in progress |
| M0 · Meet the model (hands-on + attention gate) | not started |
| M1 · Proof of real numbers | not started |
| M2 · Backend skeleton, schema freeze | not started |
| M3 · PCA artifact | not started |
| M4 · Frontend on fake data, numbers panel, design pass | not started |
| M5 · Phase 1 complete (deployable) | not started |
| M6 · Retrieval backend | not started |
| M7 · Retrieval → generation transition | not started |
| M8 · Ship | not started |

## Documentation

| File | What it is |
|---|---|
| [`BUILD_PLAN.md`](BUILD_PLAN.md) | How it gets built: stack, milestones, how to run and test at each stage |
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | The spec: locked decisions, scope, data contract, risk register |
| [`AI_Visualizer_Learning_Notes.md`](AI_Visualizer_Learning_Notes.md) | The curriculum and technical appendices — why each decision is what it is |
| [`AI_Visualizer_Project_Plan_1.md`](AI_Visualizer_Project_Plan_1.md) | Historical record of how the plan was reached, disagreements included |
| `MODEL_NOTES.md` | Written at M0: measured speed, model quirks, prompts that work |

## Running it locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

The first model load downloads ~1 GB into `~/.cache/huggingface/hub`, once. Everything runs on CPU.

Commands are added here as each milestone lands.
