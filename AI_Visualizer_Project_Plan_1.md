# AI Visualizer Project — Full Planning Context

**What this file is:** everything decided about the *AI visualization project* — not the internship-brief project from earlier in the chat. Drop this in the new project's folder/knowledge so any fresh chat there already knows the full plan.

---

## The idea, in one sentence

A website that makes the invisible, word-by-word decision process of an AI writing an answer actually visible — and makes it look good. You type a prompt, and instead of text just appearing, you watch a real small open-weight model think: a floating 3D cloud of candidate next-tokens sized by how likely each one was, lines back to whichever earlier tokens it was weighting most heavily for that pick, all slowed down, pausable, rewindable, and rotatable 360°. Before it writes, it also searches a real set of documents for relevant material, shown as a floating "galaxy" that lights up and feeds into the same writing engine. Nothing faked — every number on screen comes from a real forward pass through a real model.

## What it is, final architecture

**One pipeline, two phases, both committed (not either/or):**

- **Phase 1 — Watch it write (generation).** Real small model runs, real logits and real attention weights pulled out at every step, rendered as a rotatable 3D floating graph. This alone is a complete, working, deployable thing — a real checkpoint, not a half-project.
- **Phase 2 — Watch it search (retrieval).** A document-search step wired onto the front of Phase 1. Query flies into a "galaxy" of document chunks, relevant ones light up and get ranked, the winners feed into the same generation engine from Phase 1 to produce the final answer. This is what turns it into a full RAG (Retrieval-Augmented Generation) pipeline.

Build order is fixed: generation first (retrieval literally cannot be visualized without a writing engine to feed), retrieval second, purely additive — nothing from Phase 1 gets reworked to get to Phase 2.

## The back-and-forth that shaped this (disagreements, confusion, corrections)

This didn't arrive at the plan above in a straight line. Worth keeping the actual path — it explains *why* certain decisions were made, not just what they are.

**Semantica misread.** You linked `github.com/semantica-agi/semantica` because its graph looked like what you wanted — "how it picks the words and how it thinks." It doesn't do that: its own README states it does not expose or reconstruct what happens inside an LLM. It's an audit-trail tool for regulated industries — tracking what context went in and what decision came out, not the model's internal reasoning. What you'd actually reacted to was its *visual pattern* — a force-directed graph with a timeline scrubber — not its function. The visual language got borrowed into this project; the audit-trail function did not.

**Render library: you wanted Cosmograph, and got talked out of it.** You said "I think cosmograph looks better" and asked whether `react-force-graph-3d` could match it. Checking both directly split the name into two different things: the free open engine (`cosmos.gl`) is 2D only; the good-looking product (cosmograph.app) carries a non-commercial license. `react-force-graph-3d` got recommended instead — true 3D, MIT, and the 360°-rotation interaction from the Cosmograph demo you pointed at turned out to be its *default* behavior, not extra work. You accepted this once that was confirmed.

**Generation vs. retrieval — the real disagreement, and the one that actually changed the plan.** Full sequence, because it matters:

- Your original framing was retrieval — "how AI pulls information live." Several messages in, the discussion had quietly drifted to generation (attention, next-word selection) without either side flagging it. That drift got called out explicitly, and you were asked point-blank to confirm which one you actually meant.
- You weren't sure, and asked for it to be re-explained twice. The version that finally landed: a closed-book exam (generation — answers purely from what the model already learned) vs. an open-book exam (retrieval — searches documents first, then answers using what it found).
- You then made the catch that reframed everything: **"doesn't retrieval use generation in it?"** Correct — retrieval doesn't replace generation, it's a search step bolted onto the front of it. That's literally what RAG (Retrieval-Augmented Generation) means.
- Given that, the first recommendation was still to build generation alone first and *decide on retrieval later* — specifically to avoid the "broad and half-finished loses to one real thing, finished properly" trap your own internship research had already surfaced, independently, weeks earlier in this same chat.
- You pushed back on that caution directly: **"I want to build it all in one."** That's the version that stuck. Build order stayed fixed (generation still has to come first — retrieval needs a writing engine to feed into) but the committed scope became both phases, by your call, overriding the more cautious "ship one, decide later" recommendation.

**The ChatGPT round was a real disagreement between two AIs, not a second opinion rubber-stamping the first.** Full detail in the next section, but the shape of it: ChatGPT's plan was more elaborate (research-tool grade) and included one fabricated headline claim ("TokenPrint" as an already-built competitor — no evidence existed for it at the time). One of ChatGPT's four proposed corrections got rejected outright, then re-argued and conceded on reflection (keep the custom decode loop); the other three got adopted. Neither model just agreed with the other by default — each changed something only after being pushed on it.

## Why this project — the competitive gap (researched, not assumed)

| Tool | Stars | What it actually is | Why it's not this project |
|---|---|---|---|
| [bbycroft/llm-viz](https://bbycroft.net/llm) | 5.4k | Solo dev's 3D Three.js viz of a GPT model — the thing you originally saw and described as "floating matrices" | Fixed, canned demo. Loads one pre-baked model, same forward pass every time. Not live. |
| [BertViz](https://github.com/jessevig/bertviz) | 8.1k | Standard attention-visualization tool | Static heatmaps on text you already typed, Jupyter dropdowns. Not live generation. |
| Transformer Explainer (Georgia Tech/Polo Club, CHI 2026) | — | Runs live GPT-2 in-browser, accepts custom input, real-time next-token prediction *(corrected — initially misjudged as static)* | 2D, architecture-diagram style, not a cinematic 3D scene. Your closest "real" competitor. |
| [next-token-visualization](https://github.com/Benjoyo) | 2 | Does almost exactly Phase 1 functionally — live, real probabilities, real attention-based attribution | Rendered as plain text "pills." Proves the functionality is buildable; nobody made it beautiful. |
| [rag-visualizer](https://github.com/gzguevara/rag-visualizer) | 14 | Streamlit app, embedding plot | Static, after-the-fact only, not live. |
| [Semantica](https://github.com/semantica-agi/semantica) | 8.5k, funded company | Audit-trail graph for regulated industries — tracks what context/decisions passed through a system | **Not** an LLM-internals tool — README states explicitly it does not expose model reasoning. Borrowed only its *visual language*: force-directed graph + timeline scrubber. |
| Zep / Graphiti / mem0 | — | Real "AI memory" products, knowledge-graph backed (Neo4j) | Standard node/edge graph explorers. Correct and useful, not cinematic. |
| [RAGViz](https://github.com/cxcscmu/RAGViz) (EMNLP 2024) | — | Visualizes token-to-document attention, lets you remove a document and regenerate | Real, closest reference for Phase 2. Not 3D/cinematic. |
| [RAGExplorer](https://github.com/Thymezzz/RAGExplorer) (PacificVis 2026) | — | Diagnostic tool comparing RAG configs, testing distractor-chunk removal | Real, research-tool framing rather than portfolio-polish. |
| LLM Transparency Tool | — | Inference + contribution graphs down to heads/FFN/neurons | Real, but archived Feb 2026. |
| [TokenPrint](https://github.com/Sudharsanselvaraj/Token-Print) | 20 | **Verified real by direct fetch.** Live inference on real Qwen2.5-0.5B, real forward passes, WebSocket-streamed generation, 3D via React Three Fiber, live KV-cache readout, probability distributions, real per-token PCA projection for attention views | Small (20★/3 forks/51 commits) but genuinely functional — closest existing competitor to Phase 1. **Has zero retrieval** — no documents, no chunks, no search step. |

**The gap, precisely stated:** nobody has combined bbycroft-quality cinematic 3D execution with a pipeline that's genuinely *live* end-to-end — generation flowing continuously into retrieval into generation. TokenPrint proves Phase 1 alone is buildable solo but has no Phase 2. Since TokenPrint exists, **Phase 2 plus the continuous transition between the two phases is the actual differentiator now — Phase 1 alone is no longer enough on its own.**

## Architecture decisions (settled)

- **Render library: `react-force-graph-3d`** (wraps Three.js/WebGL). Chosen over `cosmos.gl`/Cosmograph after directly comparing them: cosmos.gl's free open engine is **2D only**; the polished-looking Cosmograph *product* is non-commercial-license-only; `react-force-graph-3d` is true 3D, MIT licensed with nothing to check, and ships **360° orbit rotation by default** (exactly the interaction from the Cosmograph demo you pointed at). Its node-count ceiling (hundreds to low-thousands) is more than enough — one generation step is a few dozen candidate tokens.
- **Model:** must be open-weight — closed APIs (GPT-4 etc.) don't expose raw logits/attention. Target a **0.5–1.5B instruct model**, output capped around ~50 tokens for v1.
- **Backend:** Hugging Face `transformers`. Real constraint confirmed: fast attention backends (SDPA/Flash Attention) generally don't materialize attention weights — getting real attention out requires `attn_implementation="eager"`, at a performance cost.
- **Decode loop:** write a **custom manual decode loop** (forward pass → logits → sample → emit event → append token → repeat, carrying `past_key_values` for KV caching) instead of relying on `generate()`. This was debated: initially cut as scope creep, then reinstated — live per-token emission that's pausable mid-generation, with full logits+attention captured every step, doesn't map cleanly onto `generate()`. A plain loop is fewer moving parts, not more.
- **Attention line rule (must be explicit):** last transformer layer, averaged across heads, top 5 earlier tokens shown. State the rule in a tooltip/legend. No layer/head selector in v1.
- **Node position must mean something:** precompute a one-time **3D PCA projection of the model's vocabulary embeddings**, pin every candidate token to those coordinates so location ≈ semantic similarity, not decoration. **Freeze positions** across generation steps and while scrubbing — a continuously re-arranging force layout makes scrubbing illegible.
- Show **~30–50 candidate tokens** per step, not the full vocabulary.
- **Phase 2 must show real chunks, not whole documents** — group/color by source doc, expose on hover: similarity score, retrieval rank, which chunks actually entered the prompt, source title. This is what proves the "document galaxy" is a real working retriever, not decoration.
- **Hosting:** frontend free on Vercel/Netlify; backend on **Hugging Face Spaces** (free tier, CPU, built for exactly this — live small-model demos). Must be a live, clickable site, not a recording.

## Scope table (converged — this is the plan)

**Required**
- Custom prompt input
- Real 0.5–1.5B open-weight model
- Live top-token probabilities
- One clearly defined attention aggregation (last layer, head-averaged, top 5)
- Stable 3D positions (PCA-projected, frozen across steps)
- Play / pause / speed / scrub controls
- Real chunk retrieval (Phase 2)
- Retrieval scores + selected context shown
- Smooth, continuous transition from retrieval into generation — the actual differentiator vs. TokenPrint
- Hosted live demo with 2–3 excellent preset prompts

**Stretch**
- Disable/remove one retrieved chunk and regenerate to compare ("this chunk ranked third — remove it, see exactly where the answer diverges." The strongest stretch idea — turns the project from a demo into a debugging tool.)
- Choose an alternate candidate token and branch generation from that point
- Temperature control exposed in the UI

**Cut, deliberately, for v1**
- Logit lens
- KV-cache visualization
- Head/layer selector dashboards
- Ablation laboratory
- Breakpoints
- Arbitrary model uploads
- Arbitrary PDF ingestion
- Formal trace versioning/export (keep a simple internal `steps[]` structure — the scrubber needs it anyway — just don't formalize or export it)
- Multiple retrieval configurations

## The pitch line (final — keep as the headline)

> Watch a real local model search its evidence and generate an answer, one token at a time. Pause, rotate, and rewind the entire run.

Five seconds to understand, thirty seconds to impress, still technically defensible ten minutes into an interview.

## How the scope got settled this way

The plan was cross-checked against ChatGPT as an independent second opinion — worth doing again for future decisions. ChatGPT's version was more elaborate/research-grade (logit lens, KV-cache views, ablation, breakpoints, formal trace export): impressive to an ML PhD, but overkill for the real audience — a recruiter giving a portfolio link 30 seconds to 2 minutes, a hiring manager who values a few deliberate, defensible decisions over ten shallow features. ChatGPT itself judged the simpler Claude version the better v1 and proposed four corrections:

1. **Keep the custom decode loop** — Claude initially filed this under "cut" as scope creep; conceded on reflection this was wrong (see decode-loop reasoning above). Adopted.
2. **Name the attention rule explicitly** (last layer, head-averaged, top 5) instead of a vague "some aggregation." Adopted.
3. **Give 3D position real meaning** via one-time PCA projection of vocabulary embeddings, not just "keep it stable." Adopted — and TokenPrint independently proves this exact technique is buildable.
4. **Phase 2 must show real chunks with real scores/ranks/sources on hover**, not just whole documents. Adopted.

One caution worth keeping in mind going forward: that same ChatGPT response also opened with a headline claim — "TokenPrint" as a fully-built competing tool — stated with total confidence but, at the time, unverifiable anywhere (no repo, no domain, no mentions). It was treated as likely fabricated rather than taken on faith. A real link surfaced later and the claim checked out on direct verification (see table above). Lesson worth keeping for this build and beyond: verify specific, confident-sounding factual claims independently — from either AI — rather than trust the confidence itself.

## Learning curriculum (not yet started — for before building)

Four tracks, roughly 2.5–3.5 weeks part-time total, comfortably inside a 3–4 month window. Track D should now be taught against the final converged scope above (custom decode loop, PCA vocab projection, eager attention), not an earlier looser version.

**Track A — how an LLM actually picks a word** *(~1 week)*
Tokens & vocabulary → embeddings → self-attention (conceptual) → logits → probabilities (softmax) → sampling (greedy / temperature / top-k / top-p) → the generation loop.
*Checkpoint: explain in six one-sentence steps what happens between hitting "generate" and the first word appearing.*

**Track B — how retrieval / "AI memory" actually works** *(~3–5 days)*
Vector similarity search (cosine) → why brute force doesn't scale (ANN/HNSW, conceptually) → the RAG pipeline end to end → knowledge graphs vs. vector stores (the real distinction behind the Semantica mix-up).
*Checkpoint: given a paragraph, manually walk through what a RAG system would retrieve for one question about it.*

**Track C — survey the existing tools, hands-on** *(~2–3 days)*
Actually use bbycroft/llm-viz, BertViz, Transformer Explainer, next-token-visualization, rag-visualizer. Build a one-page comparison table (live vs. static, functional vs. beautiful, star count) — this doubles as citable research for your website.
*Checkpoint: the comparison table itself.*

**Track D — what's needed to actually build it** *(~1 week, only once A–C are solid)*
Pulling real numbers out of a real model (HF `transformers`, `output_scores`/`output_attentions`, running a small open model locally) → turning embeddings into a picture (PCA vs. t-SNE vs. UMAP, why layout must be semantically real) → rendering a live graph in-browser (force-directed layout, WebGL vs. SVG/Canvas, what `react-force-graph-3d` actually solves) → streaming + replay (structuring a step-by-step event feed so slow-down/scrub-back is possible instead of precomputing and faking the animation).
*Checkpoint: a tiny script printing the top-5 next-token probabilities for one real prompt on one real local model — proof of real numbers before any graphics work starts.*

## Open items — not yet decided

- Exact small model (implied direction: something in the ~0.5–1.5B instruct range, per TokenPrint's Qwen2.5-0.5B precedent — not formally chosen)
- Backend framework specifics (FastAPI + WebSockets was floated for streaming, not explicitly confirmed as final)
- Exact Phase 2 corpus (brainstormed: something small, specific, and fun — song lyrics, Pokémon, NBA stats, film plots — not finalized)
- The learning curriculum had not resumed when this thread got interrupted by an unrelated tooling question
- Fold this research into content for ivansostaric.com (you'd flagged wanting to do this)

## Working with Codex + Claude Code on this build

- Commit after every meaningful chunk of work, regardless of which tool did it — a clean rollback point and a visible diff per tool.
- Never run both at once in the same working directory. Either work sequentially (finish with one, commit, switch), or give each its own git worktree/branch and merge when ready.
- Give them different roles rather than using them interchangeably — one implements a piece, the other reviews it with no memory of how it was built. This mirrors the Claude/ChatGPT cross-check pattern above that already caught one fabricated claim in this exact process.
- Keep this file in the repo root (or a renamed `PROJECT_PLAN.md` / `CLAUDE.md`) so neither tool improvises against a different idea of scope.
