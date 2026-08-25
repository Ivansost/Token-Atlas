"""Regenerate the committed browser fallback through the production event contract.

The recording is deliberately generated rather than hand-edited: it must exercise the same model,
projection, precision and event constructors as the live WebSocket.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from app.decode import generate_steps  # noqa: E402

DEFAULT_PROMPT = "What is the capital of France?"
DEFAULT_OUTPUT = ROOT / "frontend" / "src" / "fixtures" / "steps.sample.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prompt", nargs="?", default=DEFAULT_PROMPT)
    parser.add_argument("--max-tokens", type=int, default=80)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    events = list(generate_steps(args.prompt, max_new_tokens=args.max_tokens))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(f"{args.output.suffix}.tmp")
    temporary.write_text(json.dumps(events, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(args.output)

    steps = [event for event in events if event["type"] == "step"]
    print(f"wrote {len(steps)} steps to {args.output}")


if __name__ == "__main__":
    main()
