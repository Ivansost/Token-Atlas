"""The data contract. FROZEN at M2 -- both sides of the WebSocket depend on it.

Every event this project emits is constructed here and nowhere else. If the frontend and backend
ever disagree about a field, this file is the answer.

    step        one per generated token: what it considered, what it picked, what it looked at
    done        end of a run
    error       something went wrong, with a message safe to show a user

`pos3d` is null until M3 computes the PCA projection. The field exists from the start on purpose:
the schema freezes here, PCA lands a milestone later, and adding a field to a "frozen" contract one
milestone after freezing it would make the freeze meaningless.

Coordinates travel inside the event rather than as a lookup table shipped to the browser -- ~40
triples per step is far cheaper than a 1.8 MB vocabulary file every visitor downloads.
"""

from typing import Any, Optional

Vec3 = Optional[list[float]]


def token_ref(token_id: int, text: str, prob: float, pos3d: Vec3 = None) -> dict[str, Any]:
    """One candidate token: what it is, how likely the model thought it was, where it sits in 3D."""
    return {"id": int(token_id), "text": text, "prob": round(float(prob), 6), "pos3d": pos3d}


def attention_ref(pos: int, text: str, weight: float, pos3d: Vec3 = None) -> dict[str, Any]:
    """One attention target: an EARLIER POSITION in the context, and how heavily it was weighted.

    Note this is keyed by position, not token id -- the same word can appear twice in a prompt and
    be weighted differently each time.
    """
    return {"pos": int(pos), "text": text, "weight": round(float(weight), 6), "pos3d": pos3d}


def context_ref(pos: int, text: str, is_template: bool) -> dict[str, Any]:
    """One position in the context window.

    `is_template` marks tokens the chat template added -- the system prompt and role markers the
    visitor never typed. They are real parts of the context and the model genuinely attends to
    them, so they are reported rather than hidden. The frontend decides how to display them.
    """
    return {"pos": int(pos), "text": text, "is_template": bool(is_template)}


def step_event(
    step: int,
    chosen: dict[str, Any],
    candidates: list[dict[str, Any]],
    attention: list[dict[str, Any]],
    attention_row: list[float],
    context: list[dict[str, Any]],
) -> dict[str, Any]:
    """One generated token.

    chosen         the token actually emitted, as a token_ref
    candidates     the top ~40 the model considered, ranked, as token_refs
    attention      the top 5 earlier positions by weight, as attention_refs.
                   RULE: last layer, averaged across heads. Stated in the UI legend.
                   It means "which earlier tokens this position weighted most heavily".
                   It does NOT mean "why the model chose this word".
    attention_row  the FULL head-averaged row, one weight per context position, summing to ~1.0.
                   `attention` is the top 5 of exactly this. Carried in full because measurement at
                   M2 showed most attention mass lands on chat-template tokens (newlines, role
                   markers), so the frontend needs the raw row to offer any rule other than
                   "top 5 overall" -- e.g. top 5 among tokens the visitor actually typed, or a
                   heatmap across the context strip. ~1 KB per step; cheaper than a contract break.
    context        every position the model could attend to at this step, parallel to attention_row
    """
    return {
        "type": "step",
        "step": int(step),
        "chosen": chosen,
        "candidates": candidates,
        "attention": attention,
        "attention_row": [round(float(w), 6) for w in attention_row],
        "context": context,
    }


def done_event(text: str, steps: int, elapsed_s: float, stop_reason: str) -> dict[str, Any]:
    """End of a run. stop_reason is one of: "eos", "max_tokens"."""
    return {
        "type": "done",
        "text": text,
        "steps": int(steps),
        "elapsed_s": round(float(elapsed_s), 3),
        "stop_reason": stop_reason,
    }


def error_event(message: str) -> dict[str, Any]:
    return {"type": "error", "message": message}


# Phase 2 adds a `retrieval` event here at M6: query, ranked chunks with score/rank/source/used,
# and the assembled prompt preview. Deliberately not sketched yet -- it gets designed against a
# real corpus rather than guessed at now.
