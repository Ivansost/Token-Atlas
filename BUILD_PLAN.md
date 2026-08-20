# AI Visualizer — Build Plan

## Context

`PROJECT_PLAN.md` settles **what** we're building. This plan covers **how we build it, in order, slowly** — the stack, the repo layout, the working rhythm, how we run and test the model at every stage, and each milestone broken into sub-steps small enough to read as they're written. The repo today is three markdown files and no code, not even a git repo.

**This is the complete plan, not a phase one.** S0 through M8 is the entire project, finished and live on the internet, both phases included. The word "v1" in these docs means *the finished shipped thing*, and the **cut list** at the bottom is work we decided not to do at all — not a sequel we owe ourselves. The only deferred items are the three stretch ideas, and they're optional by definition.

**The simple overall plan, restated so we don't drift from it:**

> A real small model runs — on your laptop the whole time we're building, on a cloud host only at the very end. You type a prompt on the website. The model actually runs a forward pass for every single word it writes, and every one of those steps produces real numbers: which words it considered, how likely each one was, and which earlier words it was weighting most heavily. Those numbers show up **two ways at once** — as a 3D cloud of nodes you can rotate, and as a panel of the actual figures beside it, the two linked so highlighting one highlights the other. You can play it, pause it, speed it up, slow it down, and scrub backwards through the whole run. **Generation is built first.** Then retrieval gets bolted onto the front: a galaxy of real document chunks that lights up and feeds the winners into the generation engine. **The backend is proven before any of it gets drawn.**

---

## Your requirements, mapped to where they land

| What you asked for | Where it happens |
|---|---|
| **Run and test the model yourself before building on it** | **M0 — hands-on, no project code** |
| Model actually running, real numbers | M1 (hard gate), M2 |
| **See the scores and probabilities in the backend first** | M1 terminal output, M2 permanent step readout |
| Type a prompt on the website → nodes appear | M5 |
| **A panel showing the real numbers for each node** | M4.2 (fake data) → M5 (live) — required scope |
| **Panel and 3D scene highlight each other** | M4.2 |
| Play / pause / **speed up / slow down** / scrub back | M4.1 |
| **Claude + Codex skills for frontend quality** | M4.2 design pass, M8 polish pass |
| Generation first, retrieval second | M1–M5, then M6–M7 |
| Document galaxy → generation, no seam | M4.1 prototype (fake), M7 (real) |
| Hosted so people can click it | M8 |

The numbers panel, the design-skill work, and M0 are additions to `PROJECT_PLAN.md`, all **required**, not stretch.

---

## Working rhythm (the "don't one-shot it" rule)

Hybrid, per your call: **milestone-sized sessions, sub-step-sized writing.**

- A **milestone** is the unit of a session and the unit of a commit. We don't start M(n+1) in the session that finished M(n).
- Inside a milestone, work proceeds in **numbered sub-steps** — usually one file or one function. For each: I say what it does and why *before* writing it, write it, then **stop** so you can read it and ask questions. No batching three sub-steps into one silent burst.
- **Gates are hard stops.** M0 and M3 especially: if the gate fails we fix it there, we do not proceed.
- **Commit at the end of every milestone**, and at any sub-step that leaves the tree working.
- Never run Codex and Claude Code in the same working directory at once. Prefer one implementing, the other reviewing cold.

---

## How we run and test the model — at every stage

### Where it runs
**M0 through M7: entirely on your laptop.** `Qwen2.5-0.5B-Instruct` is ~1 GB and runs on CPU. No cloud, no account, no cost. The first `from_pretrained` call downloads the weights once into `~/.cache/huggingface/hub`; every run after that is offline and instant to load. Apple Silicon `mps` is available but not worth chasing — CPU is fine at this size, eager attention is better-tested on CPU, and we are deliberately running slowly anyway.

**M8 only: the backend moves to a cloud host** so a stranger can click your link (frontend goes to Vercel free regardless). Hosting is decided *last* on purpose — the choice stays cheap only if the backend has no vendor-specific code in it, so we build a plain Docker container the whole way. Default is **Modal**: $30/mo free credits, scales to zero, keeps FastAPI + WebSockets, plausibly $0 at portfolio traffic. The real cost of scale-to-zero is **cold start** — first visitor after idle waits 30–60s for a container to boot and load a gigabyte of weights — which we solve at M8 with a loading state that teaches, not with money.

### How we test it, stage by stage
| Stage | How you run it | What you're testing |
|---|---|---|
| M0 | `python backend/scripts/chat.py` — a terminal REPL | Can you talk to it? Is it any good? How fast, really? |
| M0 | `python backend/scripts/tokens.py "some text"` | How text becomes tokens, and why `·cat` will need explaining |
| M0 | `python backend/scripts/check_model.py` | **The gate:** does this model expose real attention on all 24 layers? |
| M1 | `python backend/scripts/probe.py` | Real probabilities and real attention, printed, with token text |
| M2 | `python backend/scripts/run_local.py` | The full decode loop end to end, every step's numbers in your terminal, **no browser involved** |
| M2 | `uvicorn app.main:app --reload` + browser console WebSocket | Same events, now over the wire |
| M3 | `python backend/scripts/build_pca.py --check` | Nearest neighbours of `" king"`, `" Paris"`, `" 7"` — is the projection real? |
| M4 | `npm run dev`, fixture only | The whole UI with the model switched off |
| M5+ | Both processes: `uvicorn` :8000, Vite :5173 | The real thing, locally |

`run_local.py` is the important one — it's the model-side debugger and it stays in the repo permanently. Every later milestone gets checked there before it gets checked in a browser.

---

## Tech stack

### Backend
| Piece | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | What `transformers` expects |
| Env | **`venv` + `pip`**, `requirements.txt` | Your call. Matches Appendix 3 and every tutorial |
| Model runtime | `transformers` + `torch` (CPU), `accelerate` | Only path that exposes real logits + attention |
| Model | `Qwen/Qwen2.5-0.5B-Instruct`, `attn_implementation="eager"` | Locked. Every layer full softmax attention |
| Decode | Hand-written loop carrying `past_key_values` | Not `generate()` — we need per-step emission and mid-run pause |
| Web | **FastAPI** + `uvicorn[standard]` | `[standard]` pulls the WebSocket implementation |
| Math | `numpy`, `scikit-learn` (PCA, offline only) | |
| Phase 2 | `sentence-transformers`, brute-force NumPy cosine | Exact, milliseconds at this corpus size, defensible |

**Version discipline (matters more without a lockfile):** at S0, install then `pip freeze > requirements.txt` so everything is pinned exactly. Never bump `transformers` without re-running `check_model.py` — its `past_key_values` API has already changed once (tuple-of-tuples → `Cache` object) and our decode loop sits directly on it.

### Frontend
| Piece | Choice | Why |
|---|---|---|
| Language | **JavaScript** (not TS) | Your call — less friction while iterating on visuals |
| Build | Vite + React 18 | |
| 3D | `react-force-graph-3d` (+ `three` peer) | MIT, true 3D, 360° orbit by default |
| Numbers panel | Plain React + CSS, no chart library | Ranked bars and a table — a library would weigh more than the thing itself |
| State | Plain React state — `steps[]` + `currentIndex` | The entire state model is two variables |
| Transport | Native browser `WebSocket` | No socket.io |
| **Design tooling** | **`design` skill** (layout mockups), **`dataviz` skill** (the numbers panel) | See M4.2 |

On JS the event schema is a **convention, not a compile-time contract**. Compensating: the schema lives in one place per side (`backend/app/events.py`, `frontend/src/lib/schema.js` with a dev-only `validateStep()`), and the committed `steps.sample.json` fixture is the reference both sides are checked against.

### Shape
```
Browser ── React + react-force-graph-3d + inspector panel   → Vercel (static, free)
   ↕ WebSocket (step events)
Backend ── FastAPI + uvicorn (plain Docker)                 → host chosen at M8
            ├── manual decode loop
            ├── transformers → Qwen2.5-0.5B (eager)
            ├── NumPy cosine            (Phase 2)
            └── sentence-transformers   (Phase 2)
```

---

## Repo layout

```
AIViz/
├── BUILD_PLAN.md · PROJECT_PLAN.md · learning notes · Plan_1 · README.md · .gitignore
├── MODEL_NOTES.md                   ← what M0 taught us: speed, quirks, good prompts
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py         FastAPI app + /ws endpoint
│   │   ├── model.py        load model + tokenizer once, at startup
│   │   ├── decode.py       the manual decode loop (a generator)
│   │   ├── events.py       every event this project emits, one file
│   │   └── retrieval.py    Phase 2
│   └── scripts/
│       ├── chat.py         M0 — talk to the model in the terminal
│       ├── tokens.py       M0 — see how text splits into tokens
│       ├── check_model.py  M0 — the attention gate
│       ├── probe.py        M1 — proof of real numbers
│       ├── run_local.py    M2 — full run, all numbers, no browser. Permanent debugger
│       ├── build_pca.py    M3 — offline
│       └── build_corpus.py Phase 2 — offline
└── frontend/
    ├── package.json
    └── src/
        ├── App.jsx
        ├── lib/{schema.js, useSteps.js, playback.js}
        ├── components/{Scene.jsx, Inspector.jsx, Controls.jsx, Legend.jsx}
        └── fixtures/steps.sample.json
```

`.gitignore`: `.venv/`, `__pycache__/`, `node_modules/`, `*.npy`. The PCA coordinate artifact (~1.8 MB) **is** committed — it must never change between runs.

---

## Build steps

### S0 — Scaffold
1. `git init`; first commit is the three existing docs, untouched.
2. `.gitignore`, `README.md`, copy this plan in as `BUILD_PLAN.md`.
3. `backend/` tree, `python -m venv .venv`, install torch/transformers/accelerate, `pip freeze > requirements.txt`.
4. Commit. **Stop.**

No FastAPI, no React yet.

### M0 — Meet the model ⛔ HARD GATE
*Pure hands-on. You run the model, poke at it, and decide you trust it — before a single line of project code exists. Everything here is a throwaway script except the gate.*

1. **Download it.** First `from_pretrained` pulls ~1 GB into `~/.cache/huggingface/hub`. Time the download and the cold load; write both in `MODEL_NOTES.md`.
2. **`scripts/chat.py`** — a five-line terminal REPL using plain `generate()`. This is the one place `generate()` is allowed: it's a scratch tool, not the product. Talk to it. Ask it easy things, hard things, factual things. **Find out what a 0.5B model is actually like** — it is small, it will be wrong sometimes, and it is much better at short factual continuations than at open-ended chat. Knowing its ceiling now is what makes the M8 preset prompts good instead of embarrassing.
3. **`scripts/tokens.py`** — feed it text, print the token IDs and their exact string forms. Watch `" cat"` carry its leading space, watch a long word split into pieces, print `len(tokenizer)` and see 151,936 for yourself. This is the concept your visitors will be most confused by, so you should be fluent in it first.
4. **Speed test.** Time ~20 tokens with `attn_implementation="eager"` and again with the default. Record tokens/sec in `MODEL_NOTES.md`. Two things get decided from that number: whether ~50 tokens is the right cap, and whether the eager penalty is as small as expected.
5. **`scripts/check_model.py`** — the Appendix 2 attention gate, and the only file from M0 that stays. Must print **24/24 layers returning attention** and the **last layer's row summing to ~1.0**. That row summing to 1.0 is the proof it's a real softmax distribution and not a placeholder.
6. Write up `MODEL_NOTES.md` — speed, quirks, prompts that worked well, prompts that flopped. Commit. **Stop.**

**The gate:** if `check_model.py` fails, this model is unusable for this project no matter how good it is, and we switch to SmolLM2-360M-Instruct and re-run the gate before anything else happens. This same script runs again before *any* future model swap, forever — it's the cheapest 20 lines in the build.

### M1 — Proof of real numbers ⛔ HARD GATE
*The "see it in the backend first" milestone.*
1. `scripts/probe.py` — one prompt, one forward pass, print top-5 next-token probabilities with token text.
2. Extend it — print top-5 attention weights (last layer, head-averaged) *with the text of the tokens they point back at*.
3. Commit. **Stop.**

Done when your terminal shows `" Paris" 0.8213` and five attention weights pointing at real earlier tokens. Both halves of the Phase 1 data feed, in ~40 lines. Everything after this is presentation.

### M2 — Backend skeleton · **schema freeze**
1. `app/model.py` — load model + tokenizer once at startup as a module-level singleton. Never per-request.
2. `app/decode.py` — port `probe.py` into the real loop: a generator yielding one event per token, carrying `past_key_values`, feeding **only the new token** after the first pass, breaking on EOS, capped at ~50 tokens. Greedy, fixed seed.
3. `app/events.py` — the frozen schema.
4. `scripts/run_local.py` — run a full generation in the terminal and pretty-print every step: chosen token, ranked candidates with probabilities, attention targets with weights. **Permanent.** Every later milestone gets verified here before a browser is involved.
5. `app/main.py` — FastAPI + `/ws`: receive prompt, stream events, send a terminal `done`.
6. Verify in a browser console, then commit. **Stop.**

**One schema addition decided here, not at M3:** each candidate and attention target carries `pos3d: [x,y,z]`, `null` until M3 fills it. The schema freezes at M2 but PCA lands at M3 — deciding it now avoids breaking a "frozen" contract one milestone after freezing it, and attaching ~40 coordinate triples per event beats shipping a 1.8 MB vocabulary table to every visitor.

Worth noting: **the numbers panel needs no schema change at all.** Every figure it will display is already in this event. That's the check that the schema is right.

### M3 — PCA artifact ⚠️ SOFT GATE
1. `scripts/build_pca.py` — PCA(3) over `model.get_input_embeddings().weight`, scaled into a render-friendly box, saved to disk. Offline, once, never at runtime.
2. **Sanity check before anything depends on it:** nearest neighbours of `" king"`, `" Paris"`, `" 7"` must look semantically plausible. Print the explained-variance ratio — that number goes in the legend, honestly.
3. Wire the table into `events.py` so `pos3d` gets filled.
4. Commit. **Stop.**

If the projection is an undifferentiated blob we fix it **here** — whitening, per-axis scaling, or projecting only the candidates' neighbourhood — not after the UI depends on it.

### M4.1 — Scene and playback, on fake data
Fixture-driven. The model is not in the loop, and iteration is roughly ten times faster for it.
1. Vite + React scaffold; `react-force-graph-3d` renders one static candidate cloud from a hand-written `steps.sample.json`.
2. `lib/playback.js` — `currentIndex` + timer. **Play, pause, speed up, slow down, scrub back, replay from zero.** All six fall out of one integer, because playback is decoupled from generation — the design idea the whole replay feature rests on.
3. Visual encoding: probability → node size on a **compressive scale** (√p or log p, or an 87% winner makes 1% candidates invisible), attention weight → link thickness/opacity, chosen token unmistakable at a glance, whitespace rendered visibly (`·cat`).
4. Decide what happens to previous steps' clouds — fade, persist, or collapse into a trail. This one decision is what makes the scene read as a story instead of a mess.
5. **Prototype the retrieval→generation transition here, with fake data.** It's the differentiator and the riskiest animation; it cannot be discovered at M7.
6. Commit. **Stop.**

### M4.2 — The numbers panel and the design pass
1. **Design mockup first, code second.** Use the **`design` skill** to lay out the full screen as artboards — prompt bar, 3D scene, inspector panel, transport controls, legend — settling proportions, type, and colour before any component CSS. Cheaper to move a panel in a mockup than in React.
2. **Consult the `dataviz` skill before building the panel.** It governs the probability bars, the ranked list, and the colour encoding, and keeps the panel consistent with the node sizing instead of inventing a second visual language.
3. `components/Inspector.jsx` — for the current step, always visible: chosen token and its exact probability; the ranked candidate list with rank, token text, probability as a number *and* a bar; the five attention targets with position, token text, weight; step counter; and the output text so far.
4. **Cross-highlighting, both directions.** Hover a panel row → its node lights up in 3D. Hover or click a node → its row highlights and scrolls into view. Click pins the selection so it survives while you rotate the camera.
5. `Legend.jsx` — the attention rule verbatim ("last layer, averaged across heads, top 5 earlier tokens"), the PCA variance caveat, and the framing discipline: *which earlier tokens this one weighted most heavily*, never *why it chose this word*.
6. Commit. **Stop.**

The panel is not decoration. The 3D scene is what makes someone stop scrolling; the panel is the receipts — what makes this defensible ten minutes into an interview instead of thirty seconds into one.

### M5 — Phase 1 complete 🚩 deployable checkpoint
1. `lib/useSteps.js` — WebSocket → `steps[]`. Swap the fixture for the live feed. If M4 was built right, **nothing else in the UI changes.**
2. Prompt input, honest loading state, EOS and error handling.
3. End to end locally: `uvicorn` :8000, Vite :5173. Real prompt, real nodes and real numbers appearing together, scrub back through the finished run.
4. Commit and **tag it**. **Stop.**

### M6 — Retrieval backend
1. Choose the corpus (still open) and the embedding model.
2. `scripts/build_corpus.py` — chunk, embed, save `chunks.json` + `chunk_embeddings.npy`. Offline.
3. `app/retrieval.py` — embed the query at request time, brute-force NumPy cosine over all chunks, rank, select top-k for the prompt.
4. Emit the `retrieval` event: score, rank, source, `used`, chunk text, prompt preview. Extend `run_local.py` to print it — **backend verified in the terminal before it's drawn**, same rule as M1.
5. Commit. **Stop.**

### M7 — The transition 🎯 the differentiator
1. Document galaxy renders — real chunks, grouped and coloured by source doc.
2. **Inspector panel gains a retrieval mode:** ranked chunks with cosine score, rank, source title, whether it entered the prompt, and the assembled prompt preview. Same cross-highlighting.
3. Retrieval flows **continuously** into generation — the M4.1 prototype, now on real events.
4. Commit. **Stop.**

### M8 — Ship
1. `Dockerfile` — plain, no platform SDK. Verify it runs locally before touching a host.
2. Deploy backend (Modal default), frontend to Vercel, WebSocket URL via env var.
3. Cold-start loading state that teaches ("waking the model — loading 494 million weights…"). A recruiter will not wait 45 seconds at a blank screen.
4. **Final design polish pass** with the design skills on the real thing, plus a cold Codex review with no memory of how it was built.
5. 2–3 excellent preset prompts — chosen from what `MODEL_NOTES.md` says this model is actually good at. Final honest pass over legend copy.

---

## Open items (not blocking S0–M5)

| Item | When |
|---|---|
| Phase 2 corpus — leaning Pokédex (~1000 short entries, clusters visually by type) | Before M6 |
| Embedding model (`all-MiniLM-L6-v2` is the cheap default) | M6 |
| Hosting platform (Modal is the default) | M8, deliberately late |

## Not being built — the cut list is a commitment

Logit lens · KV-cache visualization · head/layer selector · ablation lab · breakpoints · model upload · PDF ingestion · trace export · multiple retrieval configs. **Optional stretch**, in priority order: remove-a-chunk-and-regenerate, branch from an alternate token, temperature in the UI. Re-read this before adding anything.
