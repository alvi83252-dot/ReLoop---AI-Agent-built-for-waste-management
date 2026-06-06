"""Long-term session memory via append-only JSONL logs."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, TypedDict

Role = Literal["system", "user", "assistant", "event", "error"]

MAX_HISTORY_TURNS = int(os.getenv("VOICE_MEMORY_MAX_TURNS", "40"))


class LogEntry(TypedDict, total=False):
    timestamp: str
    role: Role
    text: str
    session_id: str
    meta: dict[str, Any]


def _default_log_path() -> Path:
    """Shared log under project /data so web + Python agents see the same history."""
    env_path = os.getenv("VOICE_SESSION_LOG_PATH", "").strip()
    if env_path:
        return Path(env_path)

    project_data = (
        Path(__file__).resolve().parents[2] / "data" / "voice_session_log.jsonl"
    )
    return project_data


DEFAULT_LOG_PATH = _default_log_path()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_session_id() -> str:
    return f"session-{uuid.uuid4().hex[:12]}"


def log_event(
    role: Role,
    text: str,
    *,
    log_path: Path | None = None,
    meta: dict[str, Any] | None = None,
    session_id: str | None = None,
) -> LogEntry:
    """
    Append a single JSONL entry to the session log.

    Args:
        role: Event role (system, user, assistant, event, error).
        text: Human-readable message or content.
        log_path: Optional override for log file location.
        meta: Optional structured metadata.
        session_id: Optional session identifier linking entries across runs.

    Returns:
        The entry that was written.
    """
    path = log_path or DEFAULT_LOG_PATH
    entry: LogEntry = {
        "timestamp": _now_iso(),
        "role": role,
        "text": text,
    }
    if session_id:
        entry["session_id"] = session_id
    if meta:
        entry["meta"] = meta

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")

    return entry


def load_full_session(log_path: Path | None = None) -> list[LogEntry]:
    """
    Load all entries from the session log.

    Returns:
        List of log entries in chronological order. Empty list if file missing.
    """
    path = log_path or DEFAULT_LOG_PATH
    if not path.exists():
        return []

    entries: list[LogEntry] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                entries.append(
                    {
                        "timestamp": _now_iso(),
                        "role": "error",
                        "text": f"Malformed log line skipped: {line[:120]}",
                    }
                )
    return entries


def load_conversation_history(
    log_path: Path | None = None,
    *,
    max_turns: int | None = None,
) -> list[dict[str, str]]:
    """
    Rebuild Nemotron/OpenClaw conversation history from all prior sessions.

    Returns:
        List of {"role": "...", "content": "..."} suitable for ask_nemotron().
    """
    limit = max_turns or MAX_HISTORY_TURNS
    entries = load_full_session(log_path)
    history: list[dict[str, str]] = []

    for entry in entries:
        role = entry.get("role")
        text = entry.get("text", "")
        if role in ("system", "user", "assistant") and text.strip():
            history.append({"role": role, "content": text.strip()})

    return history[-limit:]


def get_prior_session_summary(log_path: Path | None = None) -> str:
    """
    Build a short natural-language summary of prior sessions for context injection.
    """
    entries = load_full_session(log_path)
    if not entries:
        return ""

    session_starts = [
        e for e in entries if e.get("role") == "event" and "session started" in e.get("text", "").lower()
    ]
    user_turns = [e for e in entries if e.get("role") == "user"]
    assistant_turns = [e for e in entries if e.get("role") == "assistant"]

    last_assistant = assistant_turns[-1]["text"][:200] if assistant_turns else ""
    last_user = user_turns[-1]["text"][:200] if user_turns else ""

    parts = [
        f"Prior sessions on record: {max(len(session_starts), 1)}.",
        f"Total logged turns: {len(user_turns)} user, {len(assistant_turns)} assistant.",
    ]
    if last_user:
        parts.append(f"Last question: {last_user}")
    if last_assistant:
        parts.append(f"Last recommendation: {last_assistant}")

    return " ".join(parts)


def count_completed_sessions(log_path: Path | None = None) -> int:
    """Count session start events in the log."""
    entries = load_full_session(log_path)
    return sum(
        1
        for e in entries
        if e.get("role") == "event"
        and "session started" in e.get("text", "").lower()
    )
