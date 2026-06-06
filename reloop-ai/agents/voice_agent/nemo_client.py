"""NemoClaw / OpenClaw Nemotron client via `openclaw chat --json`."""

from __future__ import annotations

import json
import logging
import os
import subprocess
from typing import Any

logger = logging.getLogger(__name__)

OPENCLAW_BIN = os.getenv("OPENCLAW_BIN", "openclaw")
OPENCLAW_TIMEOUT = int(os.getenv("OPENCLAW_TIMEOUT_SEC", "120"))


def _format_history(history: list[dict[str, str]]) -> str:
    """Serialize conversation history into a single prompt block."""
    if not history:
        return ""

    lines: list[str] = []
    for turn in history[-20:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines)


def _extract_reply(payload: Any) -> str:
    """Extract assistant text from varied OpenClaw JSON shapes."""
    if isinstance(payload, str):
        return payload.strip()

    if not isinstance(payload, dict):
        return str(payload)

    for key in ("reply", "response", "content", "message", "text", "output"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    # Nested assistant message
    for key in ("assistant", "data", "result"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            extracted = _extract_reply(nested)
            if extracted:
                return extracted
        if isinstance(nested, str) and nested.strip():
            return nested.strip()

    messages = payload.get("messages")
    if isinstance(messages, list):
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "assistant":
                content = msg.get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()

    return json.dumps(payload, ensure_ascii=False)


def ask_nemotron(prompt: str, history: list[dict[str, str]]) -> str:
    """
    Send a prompt (with optional history) to Nemotron through OpenClaw.

    Args:
        prompt: Current user/system prompt.
        history: List of {"role": "...", "content": "..."} turns.

    Returns:
        Assistant reply text.

    Raises:
        RuntimeError: If OpenClaw fails or returns no usable reply.
    """
    history_block = _format_history(history)
    full_prompt = prompt if not history_block else f"{history_block}\nUSER: {prompt}"

    cmd = [OPENCLAW_BIN, "chat", "--json", full_prompt]
    logger.debug("Running OpenClaw: %s", " ".join(cmd[:3]))

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=OPENCLAW_TIMEOUT,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"'{OPENCLAW_BIN}' not found. Install OpenClaw or set OPENCLAW_BIN."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("OpenClaw timed out waiting for Nemotron") from exc

    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()

    if result.returncode != 0:
        raise RuntimeError(
            f"OpenClaw exited {result.returncode}: {stderr or stdout or 'unknown error'}"
        )

    if not stdout:
        raise RuntimeError(f"OpenClaw returned empty stdout. stderr={stderr}")

    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        # Some CLIs print plain text even with --json on failure paths
        return stdout

    reply = _extract_reply(payload)
    if not reply:
        raise RuntimeError(f"Could not parse Nemotron reply from: {stdout[:500]}")
    return reply
