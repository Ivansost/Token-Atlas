"""Loads the model once, for the lifetime of the process.

Cold load is ~27s (measured at M0). Doing that per request would make the site unusable, so the
model and tokenizer are cached at module level and shared by every caller.

`attn_implementation="eager"` is mandatory and not a performance oversight: the fast kernels
(SDPA, FlashAttention) compute attention output without ever materializing the weight matrix, so
there is nothing to hand back. Eager costs 1.18x (measured at M0) and is the only implementation
that keeps the thing this project exists to show.
"""

import time
from typing import Optional

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, PreTrainedModel, PreTrainedTokenizer

MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"

# Qwen's default system prompt is "You are Qwen, created by Alibaba Cloud. You are a helpful
# assistant." We replace it to keep answers short: at M0, 10 of 13 test answers ran past a
# 60-token ceiling mid-sentence, and a truncated sentence is a worse demo than a brief one.
SYSTEM_PROMPT = "You are a helpful assistant. Answer in one short sentence."

_tokenizer: Optional[PreTrainedTokenizer] = None
_model: Optional[PreTrainedModel] = None


def get_model() -> tuple[PreTrainedTokenizer, PreTrainedModel]:
    """Return the shared (tokenizer, model). Loads on first call, instant thereafter."""
    global _tokenizer, _model
    if _model is None:
        t0 = time.perf_counter()
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        _model = AutoModelForCausalLM.from_pretrained(MODEL_ID, attn_implementation="eager")
        _model.eval()
        print(f"[model] loaded {MODEL_ID} in {time.perf_counter() - t0:.1f}s")
    return _tokenizer, _model


def is_loaded() -> bool:
    """Used by the health endpoint so the frontend can show an honest loading state."""
    return _model is not None


@torch.no_grad()
def warm_up() -> None:
    """One tiny forward pass so the first real request doesn't pay lazy-init costs."""
    tok, model = get_model()
    model(torch.tensor([[tok.eos_token_id]]), use_cache=False)
