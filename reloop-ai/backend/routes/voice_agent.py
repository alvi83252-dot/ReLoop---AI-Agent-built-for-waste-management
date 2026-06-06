"""Voice Agent API routes."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Ensure project root is on path for agent imports
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from agents.voice_agent.launcher import LaunchResult, start_voice_agent
from agents.voice_agent.memory import (
    get_prior_session_summary,
    load_conversation_history,
    load_full_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-agent", tags=["Voice Agent"])


class StartResponse(BaseModel):
    """Response after launching the voice agent."""

    ok: bool = True
    message: str = "Voice agent started"
    status: str
    pid: int | None = None
    mode: str
    command: list[str] = Field(default_factory=list)


@router.post("/start", response_model=StartResponse)
def start_voice_agent_endpoint() -> StartResponse:
    """
    Launch the 75-minute ReLoop voice agent inside the NemoClaw sandbox.

    Uses `nemoclaw abdi exec` by default. Set VOICE_AGENT_LOCAL=true for host dev.
    """
    try:
        result: LaunchResult = start_voice_agent()
        logger.info("Voice agent launched: %s", result)
        return StartResponse(
            status=result["status"],
            pid=result["pid"],
            mode=result["mode"],
            command=result["command"],
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Launcher binary not found: {exc}. Install nemoclaw or use VOICE_AGENT_LOCAL=true.",
        ) from exc
    except Exception as exc:
        logger.exception("Failed to start voice agent")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class SessionResponse(BaseModel):
    entries: list[dict]
    count: int
    session_count: int = 0
    summary: str = ""
    history: list[dict] = Field(default_factory=list)


@router.get("/session", response_model=SessionResponse)
def get_session_log() -> SessionResponse:
    """Return the full voice agent JSONL session log and conversation memory."""
    entries = load_full_session()
    return SessionResponse(
        entries=entries,
        count=len(entries),
        session_count=len(
            [e for e in entries if e.get("role") == "event" and "session" in e.get("text", "").lower()]
        ),
        summary=get_prior_session_summary(),
        history=load_conversation_history(),
    )
