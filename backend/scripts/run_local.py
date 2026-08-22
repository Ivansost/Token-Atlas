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
    p.add_argument("--full", action="store_true",
                   help="show the ENTIRE attention row and all 40 candidates, not just the top few")
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
            print(f"           {tpl:.0%} of attention went to template tokens | {typed_note}")

            if args.full:
                # EVERYTHING the model looked at: one weight per context position, sorted.
                print(f"\n           --- full attention row, all {len(row)} positions ---")
                order = sorted(range(len(row)), key=lambda i: row[i], reverse=True)
                for i in order:
                    flag = "[tpl]" if ctx[i]["is_template"] else "     "
                    bar = "█" * max(0, round(row[i] * 60))
                    print(f"           {i:>3} {flag} {show(ctx[i]['text']):<16} "
                          f"{row[i]:.4f} {bar}")

                # EVERYTHING it considered that we kept: the 40 candidates, with running total.
                print(f"\n           --- all {len(event['candidates'])} candidates sent ---")
                running = 0.0
                for rank, c in enumerate(event["candidates"], start=1):
                    running += c["prob"]
                    print(f"           {rank:>3}. {show(c['text']):<16} {c['prob']:.6f}  "
                          f"cumulative {running:.4f}")
                print(f"           the other ~151,896 tokens share {1 - running:.4f}")
            print()

        elif event["type"] == "done":
            print(f"--- done: {event['steps']} tokens in {event['elapsed_s']}s "
                  f"({event['steps'] / max(event['elapsed_s'], 1e-9):.1f} tok/s), "
                  f"stopped on {event['stop_reason']} ---")
            print(f"\nanswer: {event['text']!r}\n")


if __name__ == "__main__":
    main()
