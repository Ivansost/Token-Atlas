"""The manual decode loop. One forward pass per token, one event per forward pass.

Why not `model.generate()`: it runs to completion and hands back finished text. This project needs
the full probability distribution and the attention row at EVERY step, emitted as it happens and
interruptible mid-run. A plain loop is fewer moving parts than fighting that abstraction.

The loop, in five lines of English:
  1. Run the model over the prompt. Read the last row of logits -> probabilities for the next token.
  2. Read the last layer's attention, average the heads, take the newest token's row.
  3. Emit an event carrying both.
  4. Pick a token (greedy), append it to the context.
  5. Feed ONLY that new token back, with the KV cache holding everything before it. Repeat.

Step 5 is the part that bites people: after the first pass you must not resend the whole sequence,
because the cache already contains it. Doing both double-counts and produces nonsense.
"""

import time
from typing import Any, Iterator

import torch

from . import events
from .model import SYSTEM_PROMPT, get_model

MAX_NEW_TOKENS = 80          # editorial, not technical -- generation runs at ~38 tok/s
TOP_K = 40                   # candidates displayed per step
ATTENTION_TOP = 5            # THE RULE: last layer, head-averaged, top 5


def show(text: str) -> str:
    """Leading spaces are part of a token. Make them visible, as the UI does."""
    return text.replace(" ", "·").replace("\n", "\\n")


def build_prompt(user_text: str) -> tuple[torch.Tensor, list[dict[str, Any]]]:
    """Apply the chat template and work out which tokens the visitor actually typed.

    The template wraps a system prompt and role markers around the question -- 29 extra tokens for
    a 7-token question, measured at M0. The model genuinely attends to them, so they are reported
    rather than hidden, flagged with `is_template` so the frontend can grey them out.

    Boundaries come from character offsets rather than token counting, so they are exact.
    """
    tok, _ = get_model()

    text = tok.apply_chat_template(
        [{"role": "system", "content": SYSTEM_PROMPT},
         {"role": "user", "content": user_text}],
        add_generation_prompt=True,
        tokenize=False,
    )

    # Where the visitor's own words sit inside that string.
    start = text.rindex(user_text) if user_text else len(text)
    end = start + len(user_text)

    enc = tok(text, return_tensors="pt", add_special_tokens=False, return_offsets_mapping=True)
    input_ids = enc["input_ids"]
    offsets = enc["offset_mapping"][0].tolist()

    context = [
        events.context_ref(
            pos=i,
            text=tok.decode([tid]),
            is_template=not (s >= start and e <= end and e > s),
        )
        for i, (tid, (s, e)) in enumerate(zip(input_ids[0].tolist(), offsets))
    ]
    return input_ids, context


_vocab_limit: int | None = None


def _decodable_limit(tok) -> int:
    """Highest token id the tokenizer can actually decode, computed once.

    PERFORMANCE TRAP, found by profiling at M2: `len(tokenizer)` calls `get_vocab()`, which builds
    a fresh 151,665-entry Python dict on every call. Used once per candidate inside the loop below
    it cost ~500 ms per step -- 23x the forward pass itself. Cache it.
    """
    global _vocab_limit
    if _vocab_limit is None:
        _vocab_limit = len(tok)
    return _vocab_limit


def _candidates(tok, probs: torch.Tensor, k: int) -> list[dict[str, Any]]:
    """Top-k tokens by probability, skipping ids the tokenizer cannot decode.

    The logits are 151,936 wide but the tokenizer only knows 151,665 tokens -- the embedding matrix
    is padded with reserved rows. Those would render as blank nodes, so they are dropped here
    rather than at draw time.
    """
    limit = _decodable_limit(tok)
    top = torch.topk(probs, k=k + 16)
    out: list[dict[str, Any]] = []
    for prob, tid in zip(top.values.tolist(), top.indices.tolist()):
        if tid >= limit:
            continue
        text = tok.decode([tid])
        if not text:
            continue
        out.append(events.token_ref(tid, text, prob))
        if len(out) == k:
            break
    return out


def generate_steps(
    user_text: str,
    max_new_tokens: int = MAX_NEW_TOKENS,
    top_k: int = TOP_K,
) -> Iterator[dict[str, Any]]:
    """Run the model and yield one event per generated token, then a `done` event."""
    tok, model = get_model()
    stop_ids = {tok.eos_token_id, tok.convert_tokens_to_ids("<|endoftext|>")}

    input_ids, context = build_prompt(user_text)
    past = None
    produced: list[int] = []
    stop_reason = "max_tokens"
    t0 = time.perf_counter()

    for step in range(max_new_tokens):
        with torch.no_grad():
            out = model(
                input_ids=input_ids,
                past_key_values=past,
                output_attentions=True,
                use_cache=True,
            )
        past = out.past_key_values

        # --- what it considered -------------------------------------------------
        probs = torch.softmax(out.logits[0, -1, :].float(), dim=-1)
        candidates = _candidates(tok, probs, top_k)

        # --- what it was looking at ---------------------------------------------
        # (batch, heads, query_len, kv_len). query_len is the prompt length on the first pass and
        # 1 on every pass after, so the last row is always "the newest token attending backwards".
        row = out.attentions[-1].mean(dim=1)[0, -1].float()
        att_top = torch.topk(row, k=min(ATTENTION_TOP, row.numel()))
        attention = [
            events.attention_ref(pos, context[pos]["text"], weight)
            for weight, pos in zip(att_top.values.tolist(), att_top.indices.tolist())
        ]

        # --- pick one -----------------------------------------------------------
        chosen_id = int(torch.argmax(probs).item())      # greedy: reproducible by design
        chosen = events.token_ref(chosen_id, tok.decode([chosen_id]), probs[chosen_id].item())

        yield events.step_event(
            step, chosen, candidates, attention, row.tolist(), list(context)
        )

        if chosen_id in stop_ids:
            stop_reason = "eos"
            break

        # The chosen token becomes the next context position, so the context and the attention row
        # stay the same length on the following step.
        produced.append(chosen_id)
        context.append(
            events.context_ref(len(context), tok.decode([chosen_id]), is_template=False)
        )
        input_ids = torch.tensor([[chosen_id]])          # ONLY the new token; the cache has the rest

    yield events.done_event(
        text=tok.decode(produced, skip_special_tokens=True),
        steps=len(produced),
        elapsed_s=time.perf_counter() - t0,
        stop_reason=stop_reason,
    )
