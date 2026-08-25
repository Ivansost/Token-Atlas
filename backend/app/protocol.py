"""Validation for the tiny client-to-server WebSocket request."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

DEFAULT_MAX_TOKENS = 80
MAX_PROMPT_CHARS = 500
MAX_TOKENS_CEILING = 120


class RequestValidationError(ValueError):
    """A client mistake whose message is safe to return verbatim."""


@dataclass(frozen=True)
class GenerationRequest:
    prompt: str
    max_tokens: int


def parse_generation_request(payload: Any) -> GenerationRequest:
    """Validate without coercion so surprising JSON values never reach generation."""
    if not isinstance(payload, dict):
        raise RequestValidationError("Request must be a JSON object.")

    prompt = payload.get("prompt")
    if not isinstance(prompt, str):
        raise RequestValidationError("Prompt must be text.")
    prompt = prompt.strip()
    if not prompt:
        raise RequestValidationError("Enter a prompt.")
    if len(prompt) > MAX_PROMPT_CHARS:
        raise RequestValidationError(
            f"Prompt is too long (maximum {MAX_PROMPT_CHARS} characters)."
        )

    max_tokens = payload.get("max_tokens", DEFAULT_MAX_TOKENS)
    if isinstance(max_tokens, bool) or not isinstance(max_tokens, int):
        raise RequestValidationError(
            f"Length must be a whole number from 1 to {MAX_TOKENS_CEILING}."
        )
    if not 1 <= max_tokens <= MAX_TOKENS_CEILING:
        raise RequestValidationError(
            f"Length must be from 1 to {MAX_TOKENS_CEILING} tokens."
        )

    return GenerationRequest(prompt=prompt, max_tokens=max_tokens)
