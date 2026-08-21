"""M0 -- see how text actually splits into tokens. Throwaway tool.

Tokens are the unit the model operates on, and they are not words. `" cat"` (with the leading
space) and `"cat"` are two different entries in the vocabulary with two different IDs. Every
probability and every attention weight in this project is attached to one of these fragments,
so the visualization is only honest if you understand them first.

    python backend/scripts/tokens.py
    python backend/scripts/tokens.py "The unbelievability of tokenization"
    python backend/scripts/tokens.py --template "what type is Bulbasaur?"

`--template` shows what Qwen actually receives after the chat template is applied -- the system
prompt and role markers wrapped around your text. Worth seeing once: those tokens are in the
context the model attends over, so they will show up in attention weights at step 1.

The site renders leading spaces as `·` for exactly the reason this script makes obvious.
"""

import argparse

from transformers import AutoTokenizer

MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"

DEFAULT_SAMPLES = [
    "The capital of France is Paris",
    "cat  cat cat",                      # same word, three different tokens
    "unbelievability",                   # one word, several pieces
    "Bulbasaur is a Grass/Poison type",  # proper nouns fragment badly
    "17 * 23 = 391",                     # digits are their own thing
]


def show(tok, text: str) -> None:
    ids = tok(text, add_special_tokens=False).input_ids
    print(f"\n  {text!r}")
    print(f"  {len(ids)} tokens")
    pieces = []
    for i in ids:
        s = tok.decode([i])
        pieces.append(f"{s.replace(' ', '·')}({i})")
    print("  " + " ".join(pieces))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("text", nargs="*", help="text to tokenize (default: a few illustrative samples)")
    p.add_argument("--model", default=MODEL_ID)
    p.add_argument("--template", action="store_true",
                   help="wrap the text in Qwen's chat template first")
    args = p.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)

    print(f"model            {args.model}")
    print(f"vocab size       {len(tok):,}")
    print(f"eos token        {tok.eos_token!r} (id {tok.eos_token_id})")
    print("leading spaces shown as ·")

    if args.template:
        text = " ".join(args.text) or "what type is Bulbasaur?"
        templated = tok.apply_chat_template(
            [{"role": "user", "content": text}], add_generation_prompt=True, tokenize=False
        )
        print("\n--- what the model actually receives ---")
        print(templated)
        print("--- tokenized ---")
        show(tok, templated)
        return

    for text in (args.text or DEFAULT_SAMPLES):
        show(tok, text)


if __name__ == "__main__":
    main()
