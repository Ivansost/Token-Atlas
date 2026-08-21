"""M0 -- talk to the model in your terminal. Throwaway tool, not part of the product.

This is the ONE place `generate()` is allowed. The real project uses a hand-written decode loop
because it needs per-step logits and attention; none of that matters here. The only goal is to
find out what a 494M-parameter model is actually like before building a website around it.

    python backend/scripts/chat.py
    python backend/scripts/chat.py --max-tokens 200

Commands inside the REPL:  /reset  clears the conversation   /quit  exits

Things worth probing while you're in here, and writing down in MODEL_NOTES.md:
  - short factual questions      ("what is the capital of France?")       -> usually fine
  - open-ended chat              ("tell me about yourself")               -> gets vague fast
  - anything needing arithmetic  ("what is 17 * 23?")                     -> often wrong
  - anything needing recent facts                                         -> it has none
  - a question about a document it can't have seen                        -> the case for Phase 2

That last one is the whole argument for retrieval, in one prompt. Find a question it fails
closed-book and remember it -- it becomes the demo prompt for the finished site.

NOTE: this loads with the default (fast) attention backend, not the eager one the product needs,
because nothing here reads attention weights. Use speed_test.py for an honest speed comparison.
"""

import argparse
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextStreamer

MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", default=MODEL_ID)
    p.add_argument("--max-tokens", type=int, default=128)
    args = p.parse_args()

    print(f"loading {args.model} ...")
    t0 = time.perf_counter()
    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model)
    model.eval()
    print(f"ready in {time.perf_counter() - t0:.1f}s   (/reset to clear, /quit to exit)\n")

    streamer = TextStreamer(tok, skip_prompt=True, skip_special_tokens=True)
    history: list[dict[str, str]] = []

    while True:
        try:
            user = input("you  > ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user:
            continue
        if user == "/quit":
            break
        if user == "/reset":
            history = []
            print("(conversation cleared)\n")
            continue

        history.append({"role": "user", "content": user})

        # Qwen2.5-Instruct expects its own chat template. Skipping it and feeding raw text is a
        # classic reason a small instruct model looks much dumber than it is.
        ids = tok.apply_chat_template(
            history, add_generation_prompt=True, return_tensors="pt", return_dict=True
        )

        print("qwen > ", end="", flush=True)
        t0 = time.perf_counter()
        with torch.no_grad():
            out = model.generate(
                **ids,
                max_new_tokens=args.max_tokens,
                do_sample=False,          # greedy, same as the product
                streamer=streamer,
                pad_token_id=tok.eos_token_id,
            )
        elapsed = time.perf_counter() - t0

        new_tokens = out.shape[-1] - ids["input_ids"].shape[-1]
        reply = tok.decode(out[0, ids["input_ids"].shape[-1]:], skip_special_tokens=True)
        history.append({"role": "assistant", "content": reply})

        print(f"       [{new_tokens} tokens in {elapsed:.1f}s = "
              f"{new_tokens / elapsed:.1f} tok/s]\n")


if __name__ == "__main__":
    main()
