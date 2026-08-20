# AI Visualizer — Learning Notes

**What this is:** the four-track curriculum from `AI_Visualizer_Project_Plan_1.md`, written out as actual lessons. Concepts first, code only where code explains something faster than words.

**How to use it:** work top to bottom. Each track ends with a checkpoint — a thing you can *do*, not a thing you've read. If you can't do the checkpoint, the track isn't finished, go back. Don't skip to Track D; it assumes A and B.

**Rough pacing:** A ≈ 1 week, B ≈ 3–5 days, C ≈ 2–3 days, D ≈ 1 week. Part-time. Total 2.5–3.5 weeks.

**One rule for the whole thing:** you are building a tool that *shows people the truth about what a model is doing*. That means you personally have to understand every number that ends up on screen. If a number appears in your UI and you can't explain where it came from, you've built a decoration, not a visualizer. That's the entire bar for this curriculum.

---

# Track A — How an LLM actually picks a word

*Target: ~1 week. This is the most important track. Phase 1 of your project is literally a rendering of this chapter.*

## The one-paragraph version (read this, then forget it, then come back at the end)

A language model does exactly one thing: given some text, it produces a score for *every single word in its vocabulary* representing how good that word would be as the next one. It picks one. It sticks that word onto the end of the text. Then it does the whole thing again from scratch. That's it. Everything else — attention, embeddings, transformers — is machinery in service of producing that one list of scores. There is no plan, no draft, no outline. It's one word at a time, forever, and the "intelligence" is an emergent property of being extremely good at that one narrow prediction.

Now the pieces.

## A1 — Tokens and vocabulary

A model doesn't see letters and it doesn't see words. It sees **tokens** — chunks of text somewhere between a character and a word.

- `"cat"` → probably 1 token
- `"unbelievable"` → probably 3 tokens (`un`, `believ`, `able`)
- `" cat"` (with a leading space) → a *different* token than `"cat"`. This trips up everyone. Spaces are usually attached to the front of the following token.
- Emoji, rare names, and code punctuation often split into several tokens each.

The full list of tokens a model knows is its **vocabulary**. Small modern models have roughly 30,000–150,000 entries. Qwen2.5-0.5B, the model TokenPrint uses, sits around 150k.

Each token has an integer **ID** — its row number in the vocabulary. So text becomes a list of ints:

```
"The cat sat"  →  ["The", " cat", " sat"]  →  [791, 8415, 7731]
```

The thing that does this conversion is the **tokenizer**. It's a separate object from the model, and it must match the model exactly — using GPT-2's tokenizer with Qwen's model produces confident, fluent garbage.

**Why this matters for your project:** the nodes in your 3D cloud are tokens, not words. Some of them will look weird — fragments like `ing`, `_`, or a bare space. That's correct, not a bug. Your tooltip should probably render tokens with visible whitespace (e.g. `·cat` or `"​ cat"`) so users understand what they're looking at. This is a real UI decision and it's worth getting right, because it's the first moment a visitor learns something they didn't know.

**Try it:** tokenize a few strings and look at the output — your own name, a sentence with numbers in it, a line of code. The goal is to stop thinking in words.

## A2 — Embeddings

An integer ID is meaningless on its own — token 8415 isn't "more" than token 791. So the first thing the model does is look up each ID in a giant table called the **embedding matrix**.

- Shape: `(vocab_size, hidden_dim)` — e.g. `(151936, 896)` for a 0.5B model.
- Row `n` is the **embedding** of token `n`: a list of ~900 numbers.
- That list of numbers is the model's learned "meaning" of that token.

The key property: **tokens with similar meanings have similar embeddings.** Not because anyone programmed that — because it fell out of training. `" king"` and `" queen"` end up near each other. `" Paris"` and `" London"` end up near each other. `" the"` ends up somewhere off in its own boring corner.

Think of it as a map with ~900 dimensions instead of 2, where distance means "relatedness."

**Why this matters for your project:** this table is exactly what you'll run PCA on in Track D to decide where each token node floats in 3D space. That's what makes your visualization *mean* something instead of being a pretty arrangement of dots. Two candidate tokens appearing close together on screen will be close because the model considers them semantically similar. That's a real, defensible claim you can make in an interview.

One detail worth knowing: many small models **tie** their input embedding matrix and their output layer — the same weights are used to turn tokens into vectors at the start and to turn vectors back into token scores at the end. It's a memory saving. It also means the "map" you project is doing double duty, which is convenient for you.

## A3 — Self-attention (the conceptual version)

This is the part everyone finds intimidating. It isn't that bad if you drop the matrices for a minute.

**The problem it solves:** to predict the next word in

> "The trophy didn't fit in the suitcase because it was too ___"

the model needs to know what "it" refers to. Words don't carry that on their own. Every word needs to be able to *look at* other words and pull in context.

**The mechanism:** for every token, at every layer, the model computes three vectors:

| Name | Think of it as | Question it answers |
|---|---|---|
| **Query** (Q) | what this token is looking for | "what kind of context do I need?" |
| **Key** (K) | what this token advertises | "what kind of context do I provide?" |
| **Value** (V) | what this token actually hands over | "here's my content" |

Then, for a given token:

1. Compare its **Query** against the **Key** of every earlier token. High match = high raw score.
2. Divide the scores by √(head dimension) — a scaling trick to keep numbers stable. Don't overthink it.
3. Run the scores through **softmax** (see A5) so they become positive and sum to 1. These are the **attention weights**.
4. Take a weighted average of every earlier token's **Value**, using those weights.
5. That average gets mixed back into the token's own representation.

So the token's representation is updated with a blend of the earlier tokens it cared about most. The attention weight for (token *i* looking at token *j*) is a real number between 0 and 1, and for a given *i* they sum to 1 across all *j*.

**Three more facts you need:**

- **Causal masking.** A token can only attend to tokens *before* it, never after. That's what makes it a generation model rather than a fill-in-the-blank model. In the attention matrix, everything above the diagonal is zeroed out.
- **Multiple heads.** This whole process runs in parallel maybe 8–16 times per layer, each with its own Q/K/V. These are **heads**. Different heads specialize — some track syntax, some track long-range references, some do something nobody has a clean name for. So attention isn't one number per pair of tokens, it's one number per pair *per head*.
- **Multiple layers.** And the whole thing repeats maybe 24 times, stacked. Early layers do local/syntactic work, later layers do more abstract work. So the full attention data for one forward pass is `(layers × heads × tokens × tokens)`. That's a lot of numbers.

**Why this matters for your project — and this is the decision your plan already locked in:** you cannot draw all of that. `24 layers × 14 heads × 40 tokens × 40 tokens` is ~537,000 numbers per step. So your plan picks: **last layer, averaged across heads, top 5 earlier tokens.** That collapses it to 5 lines per step. That is a *lossy simplification and you must say so in the UI* — a tooltip or legend stating the rule. Doing that is the difference between an honest tool and a misleading one, and an interviewer will notice which one you built.

Also worth internalizing so you don't overclaim: **attention weight is not causation.** A high attention weight from "was" to "trophy" doesn't prove the model "decided" based on the trophy. It's the best cheap signal we have for "what was it looking at," and it's genuinely informative, but the honest framing is *"which earlier tokens this one weighted most heavily,"* not *"why it chose this word."* Your plan's own pitch language is careful about this. Keep it careful.

## A4 — Logits

After the last transformer layer, the model has a final vector for the last position — a few hundred numbers summarizing everything it understands about "what comes next here."

That vector gets multiplied by the output matrix (`hidden_dim × vocab_size`) to produce one score per vocabulary entry. Those raw scores are **logits**.

- One logit per token in the vocabulary. So ~150,000 of them.
- They're unbounded — can be negative, can be 14.7, can be -3.2.
- Bigger = the model likes it more. That's all a logit means on its own.
- The shape you get back from the model is `(batch, sequence_length, vocab_size)`. You almost always want `[:, -1, :]` — the scores at the *last* position, which are the predictions for what comes next.

Logits are not probabilities. They're not on any interpretable scale. You can't say "logit 8 is twice as good as logit 4." To get something meaningful you need the next step.

## A5 — Softmax: turning scores into probabilities

**Softmax** takes a list of arbitrary numbers and returns a list of positive numbers that sums to exactly 1 — a probability distribution.

For each logit: exponentiate it, then divide by the sum of all the exponentiated logits.

```python
import numpy as np

logits = np.array([8.0, 6.0, 5.5, 1.0])
probs = np.exp(logits) / np.exp(logits).sum()
# [0.821, 0.111, 0.067, 0.0007]
```

Two things to notice, both of which will show up visually in your project:

1. **It's exponential, so it's brutally winner-take-all.** A logit gap of 2 becomes a ~7.4× gap in probability. A gap of 7 becomes a ~1,100× gap. Most of the time one token has 80–99% of the mass and everything else is a rounding error.
2. **Sometimes it's flat.** After "The capital of France is" the distribution is a spike. After "My favourite colour is" it's spread across a dozen plausible answers.

**That contrast is the single most compelling thing your visualization can show.** A confident step is a bright dominant node with faint specks around it. An uncertain step is a genuine cloud of comparable nodes. A user watching that switch back and forth *understands something about language models* they can't get from reading text output. Design for that moment. Consider making node size scale on a curve (e.g. by √p or log p) rather than raw probability, or the 0.9% candidates will be invisible pixels next to the 87% one — worth experimenting with, and worth mentioning that you thought about it.

## A6 — Sampling: actually choosing one

You have a probability distribution over 150,000 tokens. Now you pick one. There are several strategies and they change the character of the output completely.

**Greedy.** Always take the highest-probability token. Deterministic — same prompt, same output, every time. Tends toward repetitive, flat text ("I am a language model. I am a language model.").

**Temperature.** Divide the logits by a number `T` *before* softmax.

```python
probs = softmax(logits / T)
```

- `T < 1` sharpens the distribution — the leader gets even more dominant. More predictable, more boring.
- `T = 1` leaves it as the model produced it.
- `T > 1` flattens it — unlikely tokens get a real shot. More creative, more unhinged.
- `T → 0` becomes greedy.

**Top-k.** Keep only the *k* highest-probability tokens, throw away the rest, renormalize, sample from those. Cuts off the long tail of nonsense. Problem: `k` is fixed, so it's too restrictive on genuinely uncertain steps and too permissive on confident ones.

**Top-p (nucleus).** Sort by probability, keep adding tokens until their cumulative probability crosses `p` (e.g. 0.9), sample from that set. Adaptive — a small set when the model is confident, a large set when it isn't. This is what most production systems use, usually alongside temperature.

**Why this matters for your project:**

- Your "show ~30–50 candidates" is a *display* choice and it's separate from your sampling choice. Be clear about that in your own head — you might display 40 candidates while sampling with top-p 0.9 from 6. If you ever visually distinguish "displayed" from "actually in the running," that's a genuinely nice touch.
- Sampling is random, which means the same prompt gives a different run each time. For a demo, that's a feature (people will re-run it) but it makes debugging harder. **Suggestion: build with greedy or a fixed seed first,** get everything correct and reproducible, and add temperature later — your plan already lists temperature as a stretch item, which is the right call.

## A7 — The generation loop

Now put it together. This is the loop you'll be writing by hand in Track D.

```
prompt → tokenize → [ids]

repeat until done:
    forward pass over [ids]
    take logits at the last position
    (apply temperature / top-k / top-p)
    softmax → probabilities
    sample one token
    append it to [ids]
    emit an event describing this step
```

The model has **no memory between steps** other than the growing list of tokens. Step 12 is not "continuing" step 11 — it's a fresh forward pass over a slightly longer input. This is genuinely surprising to most people and is worth stating in your UI.

**The KV cache.** Naively re-running the full forward pass over the whole sequence every step is wasteful, because the Keys and Values for tokens 1..n-1 don't change when you append token n. So you cache them (`past_key_values`) and each step only computes Q/K/V for the *one new token*. This turns generation from quadratic-ish to roughly linear and is standard everywhere.

There's a practical consequence you'll hit in Track D and should file away now: **when you use the cache, the attention tensor you get back has only one query row** — shape `(batch, heads, 1, seq_len)` instead of `(batch, heads, seq_len, seq_len)`. That's the new token attending to everything before it. Which is *exactly and only* what your visualization needs. Convenient.

**Stopping.** The loop ends when you hit an end-of-sequence token, or a max token count. Yours is capped at ~50 for v1.

---

## ✅ Track A checkpoint

Out loud, from memory, in six one-sentence steps: what happens between hitting "generate" and the first word appearing on screen?

A good answer touches: tokenize → embed → stack of attention layers building context → final vector → logits over the whole vocabulary → softmax → sample → append → repeat.

**Second checkpoint, self-imposed, worth doing:** explain to someone non-technical why the model can be *uncertain* and what that looks like in the numbers. If you can do that clearly, you understand the thing your entire Phase 1 UI is built to communicate.

---

# Track B — How retrieval and "AI memory" actually work

*Target: ~3–5 days. Shorter and easier than Track A. This is Phase 2.*

## The framing that finally landed

Generation alone is a **closed-book exam** — the model answers from whatever it absorbed during training. It can't tell you what's in your company handbook, and if you ask it will invent something plausible.

Retrieval makes it an **open-book exam** — before answering, go find the relevant pages, put them in front of the model, then let it answer with those pages visible.

And the catch you spotted yourself, which is the correct instinct: **retrieval doesn't replace generation, it's a step bolted onto the front of it.** That's what the G in RAG (Retrieval-Augmented Generation) is. Everything from Track A still runs, unchanged, at the end. This is why your build order is fixed — you can't visualize documents feeding into a writing engine that doesn't exist yet.

## B1 — Embeddings again, but for whole sentences

Track A had embeddings for single tokens. Retrieval uses embeddings for entire chunks of text — a paragraph in, one vector out (typically 384–1536 numbers).

The model that does this is an **embedding model** (also called a bi-encoder), and it's a *different, separate model* from your generation model. Small, fast, purpose-trained. `sentence-transformers/all-MiniLM-L6-v2` is the classic cheap default: 384 dimensions, tiny, runs fine on CPU. There are better ones now, but the concept doesn't change.

The property that makes the whole field work: **two passages about the same thing land near each other in that space, even with no words in common.** "The feline rested on the rug" and "a cat sat on the carpet" end up as near-identical vectors. That's why this beats keyword search — it matches *meaning*, not spelling.

Important: the same embedding model must be used for the documents and for the query. Mixing two different embedding models produces two incompatible coordinate systems, and everything silently returns garbage. This is one of the most common RAG bugs.

## B2 — Cosine similarity

Given a query vector and a document vector, how do you measure "close"? Almost always **cosine similarity** — the cosine of the angle between the two vectors.

```python
cos_sim = (a @ b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

- `1.0` = pointing in the same direction (as similar as it gets)
- `0.0` = unrelated / perpendicular
- `-1.0` = opposite

It measures **direction, not length**, which is what you want — a long document and a short one about the same topic should score as similar. In practice, real text embeddings rarely go negative; useful matches usually sit somewhere in the 0.3–0.9 range, and what counts as "good" is model-dependent. Don't hardcode a threshold like "0.75 = relevant" without testing on your actual corpus.

Handy shortcut used everywhere: if you **normalize** every vector to length 1 in advance, cosine similarity becomes a plain dot product. That's why most vector databases normalize on insert.

**Why this matters for your project:** this number *is* the thing your document galaxy visualizes. Every glowing chunk glows because of a cosine score, and your plan already requires exposing that score on hover. Do it as a real number, not just a brightness — showing `0.71` next to a chunk is what proves the galaxy is a retriever rather than a screensaver.

## B3 — Chunking (the unglamorous part that decides if it works)

You don't embed whole documents. A 40-page PDF as one vector is a meaningless average of 40 pages. You split documents into **chunks** — typically a few hundred tokens each — and embed each chunk separately.

The decisions:

- **Size.** Too big and the vector gets diluted and the retrieved text wastes context. Too small and chunks lose the context needed to make sense on their own. A few hundred tokens is the usual starting point.
- **Overlap.** Chunks usually overlap by ~10–20% so a sentence sitting on a boundary isn't orphaned.
- **Where to split.** Splitting on paragraph or section boundaries beats splitting every N characters, because it respects the document's own structure.

Chunking is boring and it is *the single biggest lever on whether a RAG system works*. Most bad RAG systems are bad here, not in the model.

**Why this matters for your project:** your plan explicitly requires showing **real chunks, not whole documents**, grouped/coloured by source doc. That's the correct call and it's also visually better — a galaxy of a few hundred chunk-nodes clustering by source is a far more interesting picture than eight document blobs. On hover you're committed to showing: similarity score, retrieval rank, whether it actually made it into the prompt, and source title.

## B4 — Why brute force stops working (ANN and HNSW, conceptually)

To find the best match you *could* compute cosine similarity against every chunk and sort. For a few thousand chunks that's genuinely fine — milliseconds, and it's **exact**.

At millions of chunks it stops being fine, so real systems use **ANN — Approximate Nearest Neighbour** search: accept a tiny chance of missing the true best match in exchange for an enormous speedup.

**HNSW** (Hierarchical Navigable Small World) is the dominant algorithm. The mental model: build a multi-level graph of the vectors, like a road network with highways at the top and local streets at the bottom. To search, drop in at the highway level, greedily hop toward the query, then descend to progressively finer levels. You never look at most of the dataset. This is what powers FAISS, Qdrant, Weaviate, pgvector's HNSW index, and most others.

**Why this matters for your project — a decision, not just trivia:** your corpus is going to be small and hand-picked. **Just do brute-force NumPy cosine over all chunks.** It's exact, it's ~5 lines, it has zero dependencies, and at your scale it's instant. Adding a vector database would be resume-driven complexity that makes the demo harder to host on a free CPU Space. Know what HNSW is so you can answer the interview question "how would this scale?" — and answer it by explaining the trade-off you consciously chose not to take.

## B5 — The full RAG pipeline, end to end

```
OFFLINE (once, ahead of time):
  documents → split into chunks → embed each chunk → store vectors + text

AT QUERY TIME:
  user question
    → embed the question with the SAME model
    → cosine-similarity against all chunk vectors
    → rank, take top-k (often 3–8)
    → paste those chunks' text into a prompt template
    → hand that whole prompt to the generation model
    → Track A runs, word by word
    → answer
```

That's it. The whole field is that diagram plus engineering around each arrow.

Two things worth knowing exist, both of which your plan correctly cuts from v1:

- **Reranking.** Retrieve ~30 candidates cheaply, then run a slower, more accurate model (a cross-encoder, which reads query and chunk *together*) to reorder them and keep the top 5. Meaningfully better results, meaningfully more compute.
- **Query rewriting.** Rephrase or expand the user's question before embedding it, since raw questions are often poor search queries.

**Why this matters for your project:** notice where the seam is. The retrieval half ends with "paste chunks into a prompt," and the generation half starts with a prompt. That seam is your Phase 1 / Phase 2 boundary, and **animating it continuously — chunks flying in, becoming prompt, becoming the token cloud — is the thing the plan identifies as your actual differentiator over TokenPrint.** Build the seam deliberately, not as an afterthought. It's the money shot.

## B6 — Vector stores vs. knowledge graphs (the Semantica confusion, resolved)

Worth understanding since it's the thing that sent you down the wrong path initially.

**Vector store.** Stores embeddings. Answers "what text is semantically similar to this?" Fuzzy, great for unstructured prose, no schema needed. This is what you're building.

**Knowledge graph.** Stores explicit entities and explicit relationships — `(Ivan) —[works_at]→ (Company)`. Answers "what is connected to what, and how?" Exact, traversable multi-hop, requires someone to define the structure. Neo4j is the usual backing store. Zep/Graphiti/mem0 build "AI memory" products on this.

They answer different questions and increasingly get combined ("GraphRAG"). The thing to hold onto: **both get drawn as nodes and edges, which is why they look identical from the outside and aren't.** Semantica looks like an LLM-internals tool and is actually an audit-trail graph — it tracks what context went in and what decision came out, not what happened inside the model. You borrowed its *visual language* (force-directed graph plus timeline scrubber), not its function. That's a legitimate thing to have done, and being able to articulate the difference crisply is worth points if it ever comes up.

---

## ✅ Track B checkpoint

Take any paragraph — a Wikipedia section, a page of a book. By hand:

1. Split it into 2–3 chunks the way you'd want a chunker to.
2. Write a question about it.
3. Say which chunk should rank #1 and #2, and *why* — in terms of meaning, not shared keywords.
4. Then write out the exact prompt you'd hand the generation model, with those chunks pasted in.

Step 4 is the one people skip and it's the one that matters — it's where retrieval physically becomes generation, and it's the seam your whole Phase 2 animation is built around.

---

# Track C — Survey the existing tools, hands-on

*Target: ~2–3 days. Least theory, highest immediate payoff.*

## Why bother

Three reasons, in order of importance:

1. **You'll steal good ideas and avoid bad ones.** Every interaction problem you're about to hit — how to show a probability, how to make a scrubber feel good, what to do when there are too many nodes — has been solved badly by somebody, and well by somebody else.
2. **It's citable research for your own site.** The comparison table you produce *is* the "why does this project exist" section of your landing page. That's a real artifact, not homework.
3. **It's the answer to the interview question you will definitely get:** "didn't someone already build this?" You want to answer that with specifics and a table, not a shrug.

## What to actually go do

Use each of these for real — type your own prompts in, don't just look at screenshots.

| Tool | Where | What to focus on |
|---|---|---|
| **bbycroft/llm-viz** | bbycroft.net/llm | The 3D visual quality bar. This is the aesthetic you're chasing. Note that it's a fixed canned demo — same forward pass every time. Ask yourself what *specifically* makes it look expensive. |
| **Transformer Explainer** | Georgia Tech / Polo Club, in-browser | Your closest genuinely-live competitor. Runs real GPT-2, takes custom input. Note how it handles temperature and how it displays the probability distribution. It's 2D and diagram-shaped — that's your opening. |
| **BertViz** | GitHub, runs in Jupyter | The standard attention visualization. Look specifically at how it handles the layer/head explosion problem. You cut that selector from v1 — see what you're giving up. |
| **next-token-visualization** | github.com/Benjoyo | Functionally almost exactly your Phase 1, rendered as plain text pills. Proof the functionality is buildable solo. Also proof that nobody made it beautiful. |
| **TokenPrint** | github.com/Sudharsanselvaraj/Token-Print | Your closest overall competitor — real Qwen2.5-0.5B, WebSocket streaming, React Three Fiber, real PCA. **Read this repo's source properly.** It has zero retrieval, which is exactly where your project wins. |
| **rag-visualizer** | github.com/gzguevara/rag-visualizer | Streamlit embedding plot. Static and after-the-fact. Look at how it shows chunks and scores — this is the low bar for your Phase 2. |
| **RAGViz** (EMNLP 2024) | github.com/cxcscmu/RAGViz | The best reference for Phase 2 — token-to-document attention, and remove-a-document-and-regenerate. That last feature is your top stretch goal; see how they present it. |

## What to write down for each one

Keep it mechanical. Same fields every time, so the table writes itself:

- **Live or canned?** Can you type your own prompt and get a real forward pass?
- **Real numbers or illustrative?** Are the probabilities/attention actually from a model, or a diagram of the concept?
- **2D or 3D?**
- **Generation, retrieval, or both?**
- **Can you pause / scrub / rewind?**
- **Stars / last commit / is it maintained?**
- **One sentence: the single best idea in it.**
- **One sentence: the thing that annoyed you most using it.**

That last pair is the valuable one. The "best idea" column becomes your feature list. The "most annoying" column becomes your design principles.

## A warning, from your own plan

The TokenPrint episode is the lesson here: a confident, specific claim about a competing tool turned out to be unverifiable at the time, was treated as probably fabricated, and *then turned out to be real* when a link finally surfaced. It cuts both ways. **Verify by direct fetch — open the repo, read the code, check the commit history.** Don't take a description of a tool from me, from ChatGPT, or from a blog post. Every row in your table should be one you personally clicked.

Also check star counts and last-commit dates yourself when you do this — the numbers in the project plan were accurate when they were gathered, and repos move.

---

## ✅ Track C checkpoint

The comparison table itself, finished, in a file, with every row personally verified — plus a short "the gap" paragraph underneath stating in one or two sentences exactly what nobody has built.

Your plan already drafts that gap statement: nobody combines bbycroft-grade cinematic 3D with a pipeline that's genuinely live end to end, retrieval flowing continuously into generation. Your job in this track is to confirm that's *still true* by going and looking, and to be able to name every tool that gets close and why it doesn't.

If you discover it's no longer true — someone shipped it — that's not a disaster, that's Track C doing its job before you spent a month building. Adjust the differentiator and carry on.

---

# Track D — What's needed to actually build it

*Target: ~1 week. Only start this once A–C are solid. This is the bridge from understanding to building, and it's the only track with real code.*

## D1 — Getting real numbers out of a real model

The library is Hugging Face `transformers`. Minimum viable version:

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "Qwen/Qwen2.5-0.5B-Instruct"

tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    attn_implementation="eager",   # <-- the important bit, see below
)
model.eval()

ids = tok("The capital of France is", return_tensors="pt").input_ids

with torch.no_grad():
    out = model(ids, output_attentions=True, use_cache=True)
```

What you get back:

| Field | Shape | What it is |
|---|---|---|
| `out.logits` | `(batch, seq_len, vocab_size)` | raw scores. You want `out.logits[:, -1, :]` — predictions for the *next* token |
| `out.attentions` | tuple of `n_layers` tensors, each `(batch, heads, q_len, kv_len)` | the real attention weights |
| `out.past_key_values` | Cache object | the KV cache, feed it back next step |

**`attn_implementation="eager"` is not optional and it's the constraint your plan already flagged.** The fast attention kernels (SDPA, FlashAttention) compute the output *without ever materializing the attention weight matrix* — that's precisely why they're fast and memory-efficient. No matrix, nothing to return. Ask for `output_attentions=True` on those backends and you'll either get a warning-and-silent-fallback or nothing useful. Eager mode is slower. You are deliberately running slowly anyway. Take the trade and move on.

Getting your specific attention rule out — **last layer, averaged over heads, top 5**:

```python
att = out.attentions[-1]          # last layer:      (1, heads, q_len, kv_len)
att = att.mean(dim=1)             # avg over heads:  (1, q_len, kv_len)
row = att[0, -1]                  # last token's row: (kv_len,)
top = torch.topk(row, k=min(5, row.numel()))
# top.indices -> positions of the 5 earlier tokens it weighted most
# top.values  -> the weights themselves, each in [0, 1]
```

That's the entire attention feature. Five numbers and five indices per step. Write this before you write a single line of frontend.

*(Verified against Qwen2.5-0.5B-Instruct's actual config: 24 layers, 896 hidden dim, 151,936 vocab, 14 attention heads over 2 key-value heads, tied embeddings. The 2-vs-14 split is **grouped-query attention** — the KV heads are shared across query heads to save memory. It doesn't change anything for you: `out.attentions` still comes back with all 14 query-head rows, so `.mean(dim=1)` is still the right move.)*

## D2 — The manual decode loop

Your plan commits to writing the loop by hand rather than using `model.generate()`. The reasoning, now that you have Track A: `generate()` is a black box that runs to completion and hands you the result. You need to emit an event *per step*, pause mid-generation, and capture full logits and attention every step. Streamers and callbacks can approximate that, but you end up fighting the abstraction. A plain loop is fewer moving parts, not more.

```python
past = None
input_ids = prompt_ids            # (1, prompt_len)
generated = []
steps = []

for step_idx in range(MAX_NEW_TOKENS):          # ~50
    with torch.no_grad():
        out = model(
            input_ids=input_ids,
            past_key_values=past,
            output_attentions=True,
            use_cache=True,
        )
    past = out.past_key_values

    logits = out.logits[:, -1, :]               # (1, vocab)
    probs = torch.softmax(logits, dim=-1)

    topk = torch.topk(probs[0], k=40)           # the ~30-50 candidates you display
    chosen = sample(probs)                      # greedy at first; top-p later

    att = out.attentions[-1].mean(dim=1)[0, -1] # (kv_len,)
    att_top = torch.topk(att, k=min(5, att.numel()))

    steps.append(build_event(step_idx, topk, chosen, att_top))

    generated.append(chosen)
    input_ids = chosen.view(1, 1)               # <-- only the NEW token from now on
    if chosen.item() == tok.eos_token_id:
        break
```

Three details that will bite you if you don't know them now:

1. **After the first pass, you feed in exactly one token.** The cache holds everything else. Feeding the whole sequence *and* the cache double-counts and produces nonsense.
2. **Because of that, `q_len` is 1 from step 2 onward** — so `out.attentions[-1]` is `(1, heads, 1, kv_len)` and `[0, -1]` is just "the new token attending to everything before it." Exactly what you want, no slicing gymnastics. The first pass is the odd one out (`q_len = prompt_len`), so handle it as a special case or just always take the last row, which works for both.
3. **`past_key_values` is a `Cache` object in current `transformers`, not the old tuple-of-tuples.** Just pass it straight back in and don't try to index it by hand. If you find a tutorial doing `past[0][0]`, it's written against an old version.

## D3 — Turning embeddings into a picture (PCA)

The goal from your plan: node position must *mean* something. Same token always in the same place, and nearby tokens are semantically related.

```python
from sklearn.decomposition import PCA

emb = model.get_input_embeddings().weight.detach().float().numpy()  # (vocab, hidden)
coords = PCA(n_components=3).fit_transform(emb)                     # (vocab, 3)
# scale/centre coords into a sensible box for the renderer, then save to disk
```

**Do this once, offline, and ship the result as a file.** It's ~150k × 3 floats — small enough to serve, and it must never change between runs or your scene will reshuffle itself.

Practical notes:

- **PCA vs t-SNE vs UMAP.** t-SNE and UMAP produce prettier, more clustered pictures — but they're non-linear and non-parametric, so they're slower, have random initialization, and don't give you a stable reusable projection as cleanly. PCA is linear, deterministic, fast, and reproducible. For "same token, same place, forever," PCA is the right tool. This is a defensible decision, so be ready to defend it in exactly those terms.
- **Be honest about how much it captures.** Three PCA components out of ~900 dimensions retain only a modest fraction of the variance. The layout is *meaningfully* semantic, not *perfectly* semantic. Say so in your legend. Overclaiming here is the easiest way to get caught out by someone who knows the field; the honest version is more impressive anyway.
- If fitting PCA over the full vocabulary is slow or memory-hungry, fit on a random subsample of rows and then `.transform()` all of them. Same projection, much cheaper.

**Freeze the positions.** In `react-force-graph-3d`, a node with `fx`, `fy`, `fz` set is pinned and the physics simulation won't move it. That's how you implement "frozen across steps and while scrubbing." Worth noticing the implication: if *every* node is pinned, you're not really using the force layout at all — you're using the library for its WebGL rendering, camera orbit, and link drawing. That's completely fine, and knowing it means you won't waste days tuning force parameters that have no effect.

## D4 — Rendering a live graph in the browser

**Why WebGL and not SVG/Canvas.** SVG creates a DOM element per node — fine at 100 nodes, dying at 2,000. Canvas 2D is faster but redraws everything on the CPU each frame and has no real 3D. WebGL pushes geometry to the GPU and is the only one of the three that does actual 3D with a movable camera. `react-force-graph-3d` wraps Three.js, which wraps WebGL. You get 360° orbit, zoom, and pan as default behaviour — the interaction you liked in the Cosmograph demo, for free.

**What the library actually solves for you:** the render loop, the camera controls, node/link picking (hover and click hit-testing in 3D, which is genuinely annoying to write yourself), and the force simulation you're mostly not using.

**Your scale is small.** A few dozen candidate tokens plus a handful of attention links per step, and a few hundred chunk nodes in Phase 2. That's nowhere near the library's ceiling. Your performance problems, if any, will come from re-creating the graph data object every frame rather than from node count — mutate and refresh rather than rebuilding, and keep React from re-rendering the canvas unnecessarily.

**Things to work out early, because they're design not code:**

- How do you encode probability? Node size, brightness, opacity, or some combination. Remember the softmax problem from A5 — raw probability makes small candidates invisible, so try a compressive scale.
- How do you encode attention weight? Line thickness and opacity are the obvious two.
- What does the *chosen* token look like versus the also-rans? This needs to be instantly obvious.
- What happens to previous steps' clouds — do they fade, persist, collapse into a trail? This is the question that determines whether your scene reads as a story or as a mess. Prototype it with fake data before wiring up the model.

That last point is worth taking seriously: **build the whole frontend against a hardcoded fake `steps[]` JSON file first.** You'll iterate on the visual language a hundred times faster without a model in the loop, and it forces you to define the event schema cleanly.

## D5 — Streaming and replay

The architecture your plan implies: Python backend (FastAPI + WebSockets was floated and is the sensible default), React frontend, events pushed as they're produced.

**The critical design idea: don't animate a stream, animate a data structure.**

Generation runs at whatever speed it runs. The UI needs pause, speed control, and scrub-backwards. Those are irreconcilable if the UI renders events as they arrive. So:

1. Backend streams step events over the WebSocket as fast as the model produces them.
2. Frontend appends each one into a `steps[]` array.
3. The UI renders **`steps[currentIndex]`**, and a separate playback controller advances `currentIndex` on a timer.

Playback is then decoupled from generation entirely. Pause = stop advancing the index. Speed = change the timer interval. Scrub back = set the index lower. Replay = set it to 0. All of it falls out for free, and none of it is faking anything — every frame is a real recorded forward pass.

Your plan notes this too: keep `steps[]` as a simple internal structure, don't formalize or export it in v1.

A sketch of one event:

```json
{
  "step": 7,
  "chosen": { "id": 8415, "text": " cat", "prob": 0.62 },
  "candidates": [
    { "id": 8415, "text": " cat", "prob": 0.62 },
    { "id": 6446, "text": " dog", "prob": 0.19 }
  ],
  "attention": [
    { "pos": 2, "text": " the", "weight": 0.41 },
    { "pos": 0, "text": "The", "weight": 0.22 }
  ],
  "context": ["The", " small", " brown", " the"]
}
```

Nail this schema early. Everything on both sides of the wire depends on it, and changing it later means changing both.

**Hosting reality check.** A 0.5B model in eager attention on CPU will produce maybe a few tokens per second. That sounds bad and it isn't — you are *deliberately slowing generation down so humans can watch it*. The hardware constraint and the product goal happen to point the same direction.

⚠️ **The project plan's hosting assumption is out of date.** Hugging Face Spaces is no longer free for what you need — Gradio and Docker Spaces now require a paid plan to create. See **Appendix 3** for the current options and what to do instead. Also see Appendix 3 on cold starts, which are your real UX problem: every cheap option sleeps when idle, and a recruiter clicking your link and waiting 60 seconds for a container to wake is a real problem worth designing around.

---

## ✅ Track D checkpoint

A tiny script that prints the top-5 next-token probabilities for one real prompt on one real local model. Nothing else. No graphics.

```
Prompt: "The capital of France is"

   " Paris"     0.8213
   " a"         0.0341
   " located"   0.0198
   " the"       0.0156
   " home"      0.0089
```

When that prints on your machine, you have real numbers from a real model, and every graphics decision after that point is decoration on top of something true. That's the order that matters.

**Extend it once it works** (still no graphics): print the top-5 attention weights for the same step, with the actual token text they point back at. At that moment you have both halves of your Phase 1 data feed, on a laptop, in under 40 lines. Everything after that is presentation.

---

# Glossary — one line each

| Term | Meaning |
|---|---|
| **Token** | A chunk of text, between a character and a word. The unit models actually operate on. |
| **Vocabulary** | The full set of tokens a model knows. ~150k for the models you're targeting. |
| **Tokenizer** | Converts text ↔ token IDs. Must match the model exactly. |
| **Embedding** | A vector of numbers representing a token's (or a chunk's) meaning. Similar things → nearby vectors. |
| **Hidden dimension** | The size of those vectors inside the model. ~896 for a 0.5B model. |
| **Attention** | Mechanism letting each token pull in context from earlier tokens, weighted by relevance. |
| **Q / K / V** | Query, Key, Value — what a token seeks, advertises, and hands over. |
| **Head** | One parallel attention computation. A layer has many, each specializing. |
| **Layer** | One full block of attention + feedforward. Stacked ~24 deep. |
| **Causal mask** | Rule preventing a token from attending to future tokens. Makes generation possible. |
| **Eager attention** | The slow attention implementation that actually exposes the weight matrix. Required for you. |
| **Logits** | Raw unbounded scores, one per vocabulary token. Pre-softmax. |
| **Softmax** | Turns logits into probabilities summing to 1. Exponential, so winner-take-all. |
| **Temperature** | Divides logits before softmax. Low = predictable, high = creative. |
| **Top-k / top-p** | Sampling strategies that restrict candidates to the best *k*, or to the smallest set summing to *p*. |
| **Greedy decoding** | Always take the highest-probability token. Deterministic. |
| **KV cache** | Stored Keys/Values for previous tokens, so each step only computes the new one. |
| **Forward pass** | One run of input through the model producing logits. |
| **Chunk** | A slice of a document, embedded and stored separately. The unit of retrieval. |
| **Cosine similarity** | Angle-based closeness of two vectors. 1 = identical direction, 0 = unrelated. |
| **ANN / HNSW** | Approximate nearest-neighbour search and its dominant algorithm. For scale you don't have. |
| **Bi-encoder** | Embeds query and document separately. Fast. What you'll use. |
| **Cross-encoder** | Reads query and document together for a better score. Slow. Used for reranking. |
| **RAG** | Retrieval-Augmented Generation: search first, paste results into the prompt, then generate. |
| **Vector store** | Database of embeddings answering "what's semantically similar to this?" |
| **Knowledge graph** | Database of explicit entities and relationships answering "what connects to what?" |
| **PCA** | Linear, deterministic dimensionality reduction. Your projection from ~900D to 3D. |

---

# Suggested order of operations

1. **Track A** — end with the six-step explanation, out loud, from memory.
2. **Track D checkpoint, early.** Do the top-5 probabilities script *right after Track A*, out of order. It's ~20 lines, it makes Track A concrete, and it de-risks the entire project on day one. If you can't get real numbers out of a model, you want to know that in week one, not week five.
3. **Track B** — end with the hand-worked retrieval exercise.
4. **Track C** — the comparison table. Do this before building, because it might change what you build.
5. **Track D properly** — then the fake-data frontend, then wire the two together.

The one thing that would genuinely hurt this project is spending three weeks reading and zero weeks touching a model. Step 2 exists to prevent that.


---

# Appendix 1 — What `transformers` actually is

Two different things share the name, and conflating them is the usual source of confusion.

**"Transformer"** = the neural network *architecture*. The 2017 "Attention Is All You Need" design — attention layers plus feedforward layers, stacked. That's the thing Track A describes. It's a concept, not code.

**`transformers`** = Hugging Face's *Python library*. Code that implements hundreds of those architectures and downloads pretrained weights for you. That's the thing you `pip install`.

## What the library actually does

Four jobs:

1. **Downloads and loads models.** `AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")` hits the Hugging Face Hub, pulls ~1 GB of weights, caches them in `~/.cache/huggingface/hub`, instantiates the right Python class, loads the weights in. Second run is instant — it's cached.
2. **Tokenizers.** The matching text ↔ token-ID converter for each model.
3. **A uniform API.** The same five lines of code work for Qwen, Llama, Gemma, Mistral, Phi. Change the model string, change nothing else. This is the single most valuable thing it gives you.
4. **Convenience wrappers** — `generate()`, pipelines, chat templates. You're deliberately not using `generate()`.

**What "Auto" means:** every model on the Hub ships a `config.json` with an `architectures` field. `AutoModelForCausalLM` reads it, sees `"Qwen2ForCausalLM"`, and picks the right class for you. That's the mechanism behind "swap one string, everything still works."

**What's underneath:** PyTorch. `transformers` is a layer on top of `torch` — tensors, GPU dispatch, autograd. You'll call `torch.softmax` and `torch.topk` directly in your decode loop. `transformers` gives you the model; `torch` gives you the maths.

## The part that matters for your project

**`transformers` is white-box.** It's plain readable Python and it deliberately exposes the internals — `output_attentions`, `output_hidden_states`, raw `logits`, the embedding matrix. That's *why your project is possible with it* and impossible against a closed API.

**So do not use Ollama, llama.cpp, LM Studio, or vLLM for this.** They're the normal answer to "how do I run a model locally," they're faster than `transformers`, and they are all optimized black boxes built to return text. They will not hand you an attention matrix. If you find yourself reaching for Ollama because it's easier, you've stepped off the project.

The trade you're making: `transformers` in eager mode is the *slowest* way to run a model, and the only one that shows you its work. For this project that's the right trade, twice over — you want to see the internals, and you want it slow enough to watch.

---

# Appendix 2 — Choosing the model

## What this project actually requires

Most "best small model" advice optimizes for benchmark scores. You need something different:

| Requirement | Why |
|---|---|
| Open weights on the HF Hub | Closed APIs never expose logits or attention |
| ~0.5–1.5B params | Must run on CPU, must load fast, must be cheap to host |
| **Full softmax attention on every layer** | **Non-negotiable — see the trap below** |
| Instruct-tuned (`-Instruct` / `-it`) | Base models continue text instead of answering |
| *Not* a reasoning model | A `<think>` block ruins a 50-token cinematic demo |
| Permissive license | Apache 2.0 is cleanest for a public portfolio piece |
| Accessible embedding matrix | You're running PCA over it |

## Recommendation: `Qwen/Qwen2.5-0.5B-Instruct`

Verified from its actual `config.json`: 24 layers, hidden size 896, vocab 151,936, 14 attention heads over 2 KV heads, tied embeddings, Apache 2.0. Every layer is standard full attention. Roughly 1 GB on disk in bf16.

Decisive advantage: **TokenPrint already proved this exact model works for this exact job.** When something breaks you'll be debugging your code, not wondering whether the model is the problem. That's worth more than a couple of benchmark points.

## ⚠️ The trap: newer models can silently break this project

Qwen3.5-0.8B (released March 2026) is newer, smarter, and **would break your build**. Its config uses **hybrid attention — linear-attention layers with full attention only every 4th layer.**

Linear attention never materializes an attention weight matrix. That's the entire point of it: it's an O(n) approximation that skips building the n×n matrix. So `output_attentions=True` returns nothing usable on three out of every four layers, and your "last layer, head-averaged" rule could land on a layer that has no weights to give.

Same class of problem for anything built on Mamba/SSM/state-space blocks, or using sliding-window attention.

**The lesson: for this project, newer is not better. Architecture compatibility beats benchmark score.** Check `config.json` before you get attached.

## Alternatives, ranked

| Model | Verdict |
|---|---|
| **Qwen2.5-0.5B-Instruct** | **Start here.** Full attention, Apache 2.0, proven for this exact use case. |
| Qwen3-0.6B | Architecturally fine (28 layers, 16/8 heads, full attention) — but it's a hybrid *thinking* model that emits a long `<think>` block by default. Disableable via `enable_thinking=False`, but it's a complication you don't need in v1. |
| Llama-3.2-1B-Instruct | Better quality, 2× the size and load time. Meta community licence rather than Apache — fine for a portfolio, just know it isn't Apache. |
| SmolLM2-360M-Instruct | Even smaller and faster, Apache 2.0, fully open training data. Good fallback if 0.5B is too slow on your hardware. |
| Qwen3.5-0.8B / anything hybrid or SSM | **Avoid.** No attention weights to extract. |

Ship v1 on Qwen2.5-0.5B-Instruct. Swapping later is one string.

## The 2026 model landscape, checked directly

Every config below was read from its `config.json` on the Hub, not recalled.

| Model | Architecture (verified) | Verdict |
|---|---|---|
| **Qwen2.5-0.5B-Instruct** | `Qwen2ForCausalLM`, 24 layers, all full attention, tied embeddings, Apache 2.0 | ✅ **Use this** |
| Qwen3-0.6B | `Qwen3ForCausalLM`, 28 layers, 16/8 heads, full attention, sliding window off | ✅ Works — but thinking model |
| Qwen3-1.7B | `Qwen3ForCausalLM`, 28 layers, 2048 hidden, 16/8 heads, full attention | ✅ Works — ~3.4 GB, thinking model |
| **DeepSeek-R1-Distill-Qwen-1.5B** | `Qwen2ForCausalLM` — *literally Qwen2 underneath*, 28 layers, 1536 hidden, 12/2 heads, `tie_word_embeddings: false` | ✅ Works architecturally — but it's a reasoning distill |
| Qwen3.5-0.8B / 2B / 4B / 9B | `Qwen3_5ForConditionalGeneration`, `layer_types` = **3 linear + 1 full, repeating**; also vision-multimodal | ❌ **Only 1 layer in 4 has attention weights** |
| NVIDIA Nemotron 3 Nano 4B | `NemotronHForCausalLM`, 42 layers, `hybrid_override_pattern` = mostly Mamba — **4 attention layers out of 42** | ❌ ~90% of the model has no attention at all |
| DeepSeek V4-Flash | 284B total / 13B active MoE, MIT | ❌ Two orders of magnitude too big |

**The pattern worth noticing:** every *new* small model in 2026 is a hybrid. Linear attention and Mamba blocks are how you get cheap long context, and that's where the whole industry is going. Which means **"newest" is now actively anti-correlated with "exposes attention weights."**

That's not a problem for your project, it's a *talking point*. "I deliberately chose a 2024-generation model because the 2026 architectures replace most full-attention layers with linear approximations that never materialize an attention matrix" is a sentence that demonstrates you understand the field, not that you're behind it.

**On the DeepSeek option specifically:** `DeepSeek-R1-Distill-Qwen-1.5B` is a fine architecture — it *is* Qwen2 — and using it would let you say "DeepSeek" on your site. But it's a reasoning distill that emits long chain-of-thought before answering, it's ~3 GB, and note `tie_word_embeddings: false`, so its input embeddings and output head are separate matrices (run your PCA on `get_input_embeddings()`, deliberately). Not worth the trade for v1.

## Test any model yourself in 30 seconds

Don't trust the table above — or any model card. Run this:

```python
import torch
from transformers import AutoConfig, AutoModelForCausalLM

def check(model_id):
    cfg = AutoConfig.from_pretrained(model_id, trust_remote_code=True)
    d = cfg.to_dict()
    flags = [k for k in ("layer_types", "hybrid_override_pattern", "linear_attention",
                         "mamba_num_heads", "use_sliding_window") if d.get(k)]
    print(f"{model_id}\n  red-flag config fields: {flags or 'none'}")

    m = AutoModelForCausalLM.from_pretrained(
        model_id, attn_implementation="eager", trust_remote_code=True)
    with torch.no_grad():
        out = m(torch.tensor([[1, 2, 3, 4, 5]]), output_attentions=True)

    if not out.attentions:
        print("  ✗ no attention weights returned at all"); return

    real = [a is not None for a in out.attentions]
    print(f"  layers returning attention: {sum(real)} / {cfg.num_hidden_layers}")

    last = out.attentions[-1]
    if last is None:
        print("  ✗ LAST layer has no attention — your aggregation rule breaks here")
    else:
        print(f"  last layer shape: {tuple(last.shape)}")
        print(f"  row sums to {last[0,0,-1].sum():.4f} (should be ~1.0)")

check("Qwen/Qwen2.5-0.5B-Instruct")
```

Two things to look for: **`sum(real)` must equal the layer count**, and the **last layer's attention row must sum to ~1.0** — proof it's a real softmax distribution and not a placeholder. If either fails, the model is unusable for this project no matter how good its benchmarks are.

Run this as part of your Track D checkpoint. It's the single highest-leverage 20 lines in the whole build.

## How to vet a model yourself, in 60 seconds

Browse: `huggingface.co/models` → filter **Task: Text Generation** + **Libraries: Transformers**, then filter by parameter count and sort by trending or downloads.

Then, before downloading anything, open the config directly:

```
https://huggingface.co/<org>/<model>/blob/main/config.json
```

Checklist:

1. **`architectures`** — is it a `...ForCausalLM` class `transformers` supports?
2. **Search the config for `linear_attention`, `layer_types`, `hybrid`, `mamba`, `ssm`, `sliding_window`.** Any hit → investigate before committing. **This is your project's specific landmine.**
3. **`num_hidden_layers`, `num_attention_heads`, `hidden_size`, `vocab_size`** — sanity-check the shapes you'll be slicing.
4. **`tie_word_embeddings`** — nice to know for the PCA step.
5. **Licence** on the model card. Apache 2.0 / MIT = no thinking required.
6. **Is it the `-Instruct` variant?** A base model won't answer questions, it'll just continue your sentence.
7. **Disk size:** params × 2 bytes for bf16. 0.5B ≈ 1 GB.

---

# Appendix 3 — How you'll actually run it

## Local development (where you'll spend most of the project)

```bash
python -m venv .venv
source .venv/bin/activate
pip install torch transformers accelerate
```

First `from_pretrained` call downloads ~1 GB into `~/.cache/huggingface/hub`. One time.

On Apple Silicon you can try `model.to("mps")` for a speedup, but **CPU is completely fine at this size** — and eager-attention outputs are better-tested on CPU. Since you're deliberately slowing generation down anyway, don't spend time optimizing this.

## The shape of the app

```
Browser  ──  React + react-force-graph-3d
   ↕  WebSocket  (step events)
Backend  ──  FastAPI (Python)
              ├─ your manual decode loop
              ├─ transformers → Qwen2.5-0.5B-Instruct
              └─ NumPy cosine over chunk vectors   (Phase 2)
```

Two processes on your laptop during development: `uvicorn main:app --reload` on :8000, and your Vite dev server on :5173.

## ⚠️ Hosting — the project plan is out of date here

The plan says "backend on Hugging Face Spaces (free tier, CPU)". **That is no longer free.** Current HF documentation: *"Static Spaces are free for everyone. Gradio and Docker Spaces run on compute and require a paid plan to create — PRO for personal accounts, Team or Enterprise for organizations."*

There is a free-account exception — up to 2 Gradio Spaces on **ZeroGPU** — but it doesn't help you: ZeroGPU is **Gradio-SDK-only** (explicitly not FastAPI or Docker), and free accounts get **5 minutes of GPU time per day**. That's not a portfolio demo.

Current realistic options:

| Option | Cost | Verdict |
|---|---|---|
| **Modal** | $30/mo free credits | **Best free path.** Serverless, scales to zero, per-second billing, supports web endpoints + WebSockets. At portfolio traffic you'd plausibly never exceed the credits. |
| **HF Spaces + PRO** | $9/mo | Cleanest low-friction path. Docker Space on CPU Basic = 2 vCPU / 16 GB RAM / 50 GB disk, no hourly charge. Sleeps after 48h idle, wakes on visit. Keeps your FastAPI + WebSocket design intact. |
| **Google Cloud Run** | ~free at low traffic | Scales to zero, WebSocket support, generous free tier. Needs a card on file; cold starts. |
| **Oracle Cloud Always Free** | free forever | 4 ARM cores / 24 GB RAM. Genuinely free, genuinely painful to provision. |
| **Render free tier** | free | **Won't work.** 512 MB RAM and 0.1 CPU — your model needs ~1 GB just for weights. You'd need their 2 GB Standard plan. |

**Frontend goes on Vercel or Netlify regardless** — static, free, instant, no caveats.

## Cold start is your real UX problem

Compute isn't the issue; a few tokens per second is *desirable* here. The issue is that every scale-to-zero option means the first visitor waits 30–60 seconds while a container boots and loads a gigabyte of weights.

Design for it instead of fighting it. A loading state that says *"waking the model — loading 494 million weights…"* with a progress indicator is honest, on-theme, and teaches something before the demo even starts. A recruiter staring at a blank screen for 45 seconds closes the tab.

---

# Appendix 4 — Yes, you're using brute force, deliberately

Brute force shows up in three places, and in all three it's the correct engineering call, not a shortcut.

**1. Retrieval (Phase 2).** Cosine similarity against every chunk, then sort. No index, no ANN, no vector database. At a few hundred to a few thousand chunks this is a single NumPy matrix multiply taking milliseconds, and it's **exact** — no approximation error, ever.

**2. Candidate selection (Phase 1).** You softmax the full ~152,000-entry vocabulary at every step and take the top 40. No pruning, no tricks.

**3. PCA.** One projection over the entire vocabulary embedding matrix. The one place to be careful: do this **once, offline, save the coordinates to a file.** Never at runtime.

And the model itself is brute force by its nature: it computes a score for all 151,936 vocabulary entries every single step, then discards 151,935 of them. It doesn't narrow down or search. It evaluates everything, then picks one.

**Why this is right, and how to defend it.** Every "proper" alternative — FAISS, HNSW, Pinecone, Qdrant — is a *scaling* optimization that trades exactness for speed at a scale you don't have. Adopting one would mean more dependencies, a heavier container, harder hosting, and approximate results, to solve a problem that doesn't exist in your project.

In an interview, *"brute-force cosine, because at 800 chunks it's exact and takes 3 milliseconds — here's the point where I'd switch to HNSW and why"* is a **stronger** answer than *"I used a vector database."* The first shows you understand the trade-off. The second shows you followed a tutorial.
