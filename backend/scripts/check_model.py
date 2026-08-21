"""The attention gate. Run this before trusting any model with this project.

This project renders REAL attention weights. That only works if the model materializes an
attention matrix on every layer -- which modern hybrid architectures (linear attention, Mamba/SSM
blocks) deliberately do not do, because skipping that matrix is the entire point of them.

Two things must be true, and this script proves both:

  1. Every layer returns an attention tensor.
  2. The last layer's attention row sums to ~1.0, proving it is a real softmax distribution
     and not a placeholder.

Run it before any model swap, and after any `transformers` upgrade -- the APIs it exercises
(`attn_implementation="eager"`, `output_attentions=True`, the `past_key_values` cache) are the
ones this project sits directly on top of.

    python backend/scripts/check_model.py
    python backend/scripts/check_model.py --model HuggingFaceTB/SmolLM2-360M-Instruct

Exit code 0 = usable. Exit code 1 = do not build on this model.
"""

import argparse
import sys
from collections import Counter

import torch
from transformers import AutoConfig, AutoModelForCausalLM

DEFAULT_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"

# Config fields that suggest an architecture which never builds an attention matrix.
# NOTE: `layer_types` is deliberately NOT in this list. transformers 5.x auto-populates it for
# every model, so its mere presence means nothing -- Qwen2.5-0.5B reports 24x "full_attention".
# What matters is whether it contains anything OTHER than full attention, checked separately below.
RED_FLAG_FIELDS = (
    "hybrid_override_pattern",   # NVIDIA Nemotron-H: mostly Mamba
    "linear_attention",
    "mamba_num_heads",
    "ssm_cfg",
)


def check(model_id: str) -> bool:
    ok = True
    print(f"\n=== {model_id} ===\n")

    cfg = AutoConfig.from_pretrained(model_id, trust_remote_code=True)
    d = cfg.to_dict()

    print(f"architectures     {cfg.architectures}")
    print(f"layers            {cfg.num_hidden_layers}")
    print(f"hidden size       {cfg.hidden_size}")
    print(f"vocab size        {cfg.vocab_size}")
    print(f"attention heads   {cfg.num_attention_heads} query / "
          f"{getattr(cfg, 'num_key_value_heads', cfg.num_attention_heads)} kv")
    print(f"tied embeddings   {cfg.tie_word_embeddings}")

    # --- config-level red flags -------------------------------------------------
    flags = [f for f in RED_FLAG_FIELDS if d.get(f)]
    if flags:
        print(f"\n  [FAIL] hybrid/SSM config fields present: {flags}")
        ok = False

    layer_types = d.get("layer_types")
    if layer_types:
        kinds = Counter(layer_types)
        non_full = {k: n for k, n in kinds.items() if k != "full_attention"}
        print(f"layer_types       {dict(kinds)}")
        if non_full:
            print(f"\n  [FAIL] {sum(non_full.values())} layer(s) are not full attention: {non_full}")
            print("         Linear/sliding/SSM layers never materialize an attention matrix.")
            ok = False

    if d.get("use_sliding_window"):
        print(f"\n  [FAIL] sliding window attention is enabled")
        ok = False

    # --- the real test: does it actually hand back attention? -------------------
    model = AutoModelForCausalLM.from_pretrained(
        model_id, attn_implementation="eager", trust_remote_code=True
    )
    model.eval()

    ids = torch.tensor([[1, 2, 3, 4, 5]])
    with torch.no_grad():
        out = model(ids, output_attentions=True, use_cache=True)

    if not out.attentions:
        print("\n  [FAIL] no attention weights returned at all")
        return False

    returned = sum(a is not None for a in out.attentions)
    print(f"\nlayers returning attention   {returned} / {cfg.num_hidden_layers}")
    if returned != cfg.num_hidden_layers:
        print("  [FAIL] some layers returned nothing")
        ok = False

    last = out.attentions[-1]
    if last is None:
        print("  [FAIL] LAST layer has no attention -- the aggregation rule breaks here")
        return False

    # (batch, heads, query_len, kv_len). We only ever use the final query row.
    print(f"last layer shape             {tuple(last.shape)}")
    row_sum = last[0, 0, -1].sum().item()
    print(f"last layer row sums to       {row_sum:.4f}   (must be ~1.0)")
    if abs(row_sum - 1.0) > 1e-2:
        print("  [FAIL] not a real softmax distribution")
        ok = False

    # The KV cache is the other API this project depends on. Confirm it comes back and that a
    # single-token follow-up pass produces a (batch, heads, 1, kv_len) attention row.
    if out.past_key_values is None:
        print("  [FAIL] no past_key_values returned -- the decode loop needs the KV cache")
        ok = False
    else:
        with torch.no_grad():
            step = model(torch.tensor([[6]]), past_key_values=out.past_key_values,
                         output_attentions=True, use_cache=True)
        shape = tuple(step.attentions[-1].shape)
        print(f"cached step attn shape       {shape}   (query_len must be 1)")
        if shape[2] != 1 or shape[3] != ids.shape[1] + 1:
            print("  [FAIL] cached step did not produce one new row over the full context")
            ok = False

    return ok


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", default=DEFAULT_MODEL)
    args = p.parse_args()

    passed = check(args.model)
    print("\n" + ("PASS -- usable for this project" if passed
                  else "FAIL -- do not build on this model"))
    sys.exit(0 if passed else 1)
