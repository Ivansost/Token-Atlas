"""Watch a full generation in the terminal. No browser, no WebSocket, no frontend.

This is the model-side debugger and it is permanent. Every backend change gets checked here first
-- if the numbers are wrong, they are wrong before any pixel is involved, and this is where you
find out.

    python backend/scripts/run_local.py
    python backend/scripts/run_local.py "What is the capital of France?"
    python backend/scripts/run_local.py "Explain gravity." --max-tokens 30 --top 10
    python backend/scripts/run_local.py --json          # raw events, exactly as the wire sees them

[tpl] marks a context position the chat template added -- text the visitor never typed.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.decode import generate_steps, show  # noqa: E402

DEFAULT_PROMPT = "What is the capital of France?"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("prompt", nargs="*", default=None)
    p.add_argument("--max-tokens", type=int, default=40)
    p.add_argument("--top", type=int, default=6, help="candidates to print per step (of 40 sent)")
    p.add_argument("--json", action="store_true", help="dump raw events instead of a readable view")
    args = p.parse_args()

    prompt = " ".join(args.prompt) if args.prompt else DEFAULT_PROMPT
    first = True

    for event in generate_steps(prompt, max_new_tokens=args.max_tokens):
        if args.json:
            print(json.dumps(event))
            continue

        if event["type"] == "step":
            if first:
                ctx = event["context"]
                typed = sum(1 for c in ctx if not c["is_template"])
                print(f"\nprompt   {prompt!r}")
                print(f"context  {len(ctx)} tokens "
                      f"({len(ctx) - typed} template, {typed} typed by the user)")
                print(f"typed    {' '.join(show(c['text']) for c in ctx if not c['is_template'])}\n")
                first = False

            chosen = event["chosen"]
            print(f"step {event['step']:>2}   ->  {show(chosen['text']):<14} p={chosen['prob']:.4f}")

            cands = " ".join(
                f"{show(c['text'])}={c['prob']:.3f}" for c in event["candidates"][:args.top]
            )
            print(f"           considered: {cands}")

            ctx = event["context"]
            attn = " ".join(
                f"{show(a['text'])}@{a['pos']}={a['weight']:.3f}"
                f"{'[tpl]' if ctx[a['pos']]['is_template'] else ''}"
                for a in event["attention"]
            )
            print(f"           looked at:  {attn}")

            # How much attention went to chat-template scaffolding the user never typed.
            # This is the number that decides how M4 draws attention lines.
            row = event["attention_row"]
            tpl = sum(w for w, c in zip(row, ctx) if c["is_template"])
            best_typed = max(
                ((w, i) for i, (w, c) in enumerate(zip(row, ctx)) if not c["is_template"]),
                default=(0.0, -1),
            )
            typed_note = (
                f"best non-template: {show(ctx[best_typed[1]]['text'])}@{best_typed[1]}"
                f"={best_typed[0]:.3f}" if best_typed[1] >= 0 else "none"
            )
            print(f"           {tpl:.0%} of attention went to template tokens | {typed_note}\n")

        elif event["type"] == "done":
            print(f"--- done: {event['steps']} tokens in {event['elapsed_s']}s "
                  f"({event['steps'] / max(event['elapsed_s'], 1e-9):.1f} tok/s), "
                  f"stopped on {event['stop_reason']} ---")
            print(f"\nanswer: {event['text']!r}\n")


if __name__ == "__main__":
    main()
