"""M0 -- how much does eager attention actually cost us? Throwaway measurement.

The project is forced onto `attn_implementation="eager"` because the fast kernels (SDPA,
FlashAttention) never build the attention matrix, so there is nothing to hand back. Eager is
slower. This measures how much slower, on your hardware, so the ~50-token cap is a decision
backed by a number instead of a guess.

    python backend/scripts/speed_test.py
    python backend/scripts/speed_test.py --tokens 50

It runs the same hand-written decode loop the product will use -- forward pass, take the last
row of logits, argmax, feed only the new token back with the KV cache -- so it also serves as a
rehearsal of the M2 loop mechanics.

Reported separately:
  prefill   the first pass over the whole prompt (paid once)
  decode    per-token cost after that (paid ~50 times, this is what the user watches)
"""

import argparse
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"
PROMPT = "The capital of France is"


def run(model, tok, n_tokens: int, want_attention: bool) -> dict:
    ids = tok(PROMPT, return_tensors="pt").input_ids

    t0 = time.perf_counter()
    with torch.no_grad():
        out = model(ids, output_attentions=want_attention, use_cache=True)
    prefill = time.perf_counter() - t0

    past = out.past_key_values
    next_id = out.logits[:, -1, :].argmax(dim=-1, keepdim=True)

    t0 = time.perf_counter()
    for _ in range(n_tokens - 1):
        with torch.no_grad():
            out = model(next_id, past_key_values=past,
                        output_attentions=want_attention, use_cache=True)
        past = out.past_key_values
        # The two tensors the product actually needs, pulled every step so the cost is honest.
        probs = torch.softmax(out.logits[:, -1, :], dim=-1)
        if want_attention:
            _ = out.attentions[-1].mean(dim=1)[0, -1]
        next_id = probs.argmax(dim=-1, keepdim=True)
    decode = time.perf_counter() - t0

    return {
        "prefill": prefill,
        "decode_total": decode,
        "per_token": decode / max(n_tokens - 1, 1),
        "tok_per_s": (n_tokens - 1) / decode if decode else float("inf"),
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", default=MODEL_ID)
    p.add_argument("--tokens", type=int, default=30)
    args = p.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)
    results = {}

    for label, impl, want_attn in [
        ("eager + attention  (what the product does)", "eager", True),
        ("eager, no attention", "eager", False),
        ("sdpa, no attention  (what a normal app does)", "sdpa", False),
    ]:
        model = AutoModelForCausalLM.from_pretrained(args.model, attn_implementation=impl)
        model.eval()
        run(model, tok, 5, want_attn)          # warm-up, not measured
        results[label] = run(model, tok, args.tokens, want_attn)

    print(f"\n{args.tokens} tokens from {PROMPT!r}\n")
    print(f"{'':45} {'prefill':>9} {'per token':>10} {'tok/s':>8}")
    for label, r in results.items():
        print(f"{label:45} {r['prefill']*1000:>8.0f}ms {r['per_token']*1000:>9.0f}ms "
              f"{r['tok_per_s']:>8.1f}")

    product = results["eager + attention  (what the product does)"]["tok_per_s"]
    baseline = results["sdpa, no attention  (what a normal app does)"]["tok_per_s"]
    print(f"\neager+attention costs {baseline / product:.2f}x vs a normal app")
    print(f"50 tokens would take ~{50 / product:.1f}s of generation")


if __name__ == "__main__":
    main()
