"""M1 -- proof of real numbers. The whole project in miniature, with no graphics.

One prompt, one forward pass, and the ranked list of tokens the model considered for the next
position. Every number printed here is pulled straight out of the model; nothing is estimated,
smoothed, or made up. When this prints, the data feed the website will render exists.

    python backend/scripts/probe.py
    python backend/scripts/probe.py "The Eiffel Tower is located in"
    python backend/scripts/probe.py --chat "What type is Bulbasaur?"
    python backend/scripts/probe.py --top 20

--chat wraps the prompt in Qwen's chat template, which is what the real product sends. It adds
~29 scaffolding tokens the user never typed -- see the notes in this file.
"""

import argparse

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"
DEFAULT_PROMPT = "The capital of France is"


def show(s: str) -> str:
    """Leading spaces are part of the token. Make them visible, exactly as the site will."""
    return s.replace(" ", "·").replace("\n", "\\n")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("prompt", nargs="*", default=None)
    p.add_argument("--model", default=MODEL_ID)
    p.add_argument("--top", type=int, default=5, help="how many candidates to print")
    p.add_argument("--chat", action="store_true", help="wrap in Qwen's chat template")
    args = p.parse_args()

    prompt = " ".join(args.prompt) if args.prompt else DEFAULT_PROMPT

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, attn_implementation="eager")
    model.eval()

    if args.chat:
        ids = tok.apply_chat_template(
            [{"role": "user", "content": prompt}],
            add_generation_prompt=True, return_tensors="pt",
        )
    else:
        ids = tok(prompt, return_tensors="pt").input_ids

    # THE forward pass. Everything below is reading numbers off this one result.
    with torch.no_grad():
        out = model(ids, output_attentions=True, use_cache=True)

    context = [tok.decode([i]) for i in ids[0]]

    print(f"\nPrompt   {prompt!r}")
    print(f"Context  {len(context)} tokens: {' '.join(show(t) for t in context)}")

    # logits are (batch, seq_len, vocab). The last row predicts the NEXT token.
    logits = out.logits[0, -1, :]
    probs = torch.softmax(logits, dim=-1)
    top = torch.topk(probs, k=args.top)

    print(f"\nTop {args.top} candidates for the next token  "
          f"(out of {probs.numel():,})\n")
    for rank, (prob, tid) in enumerate(zip(top.values, top.indices), start=1):
        text = show(tok.decode([tid]))
        bar = "█" * max(1, round(prob.item() * 40))
        print(f"  {rank}. {text:<14} {prob.item():.4f}  {bar}")

    mass = top.values.sum().item()
    print(f"\n  these {args.top} hold {mass:.1%} of the probability mass; "
          f"the other {probs.numel() - args.top:,} share {1 - mass:.1%}")

    # --- the other half of the feed: attention -------------------------------------
    # THE RULE, stated once and never varied: last layer, averaged across heads, top 5.
    # out.attentions is a tuple of n_layers tensors, each (batch, heads, query_len, kv_len).
    att = out.attentions[-1]          # last layer      -> (1, 14, seq, seq)
    att = att.mean(dim=1)             # average heads   -> (1, seq, seq)
    row = att[0, -1]                  # the newest token's row -> (seq,)

    att_top = torch.topk(row, k=min(args.top, row.numel()))

    print(f"\nWhich earlier tokens the model weighted most heavily\n"
          f"  (last layer of {len(out.attentions)}, averaged over "
          f"{out.attentions[-1].shape[1]} heads)\n")
    for rank, (weight, pos) in enumerate(zip(att_top.values, att_top.indices), start=1):
        text = show(context[pos])
        bar = "█" * max(1, round(weight.item() * 40))
        print(f"  {rank}. pos {pos.item():<3} {text:<14} {weight.item():.4f}  {bar}")

    print(f"\n  the full row sums to {row.sum().item():.4f} "
          f"across all {row.numel()} context positions")
    print("\n  NOTE: this is 'which earlier tokens this position weighted most heavily'.")
    print("        It is NOT 'why the model chose that word'. Never claim the second one.")


if __name__ == "__main__":
    main()
