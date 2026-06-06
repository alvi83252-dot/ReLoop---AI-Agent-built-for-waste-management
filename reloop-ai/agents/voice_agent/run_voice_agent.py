#!/usr/bin/env python3
"""
ReLoop AI Voice Agent — 75-minute autonomous session.

Integrates:
  - OpenClaw / Nemotron for reasoning (`openclaw chat --json`)
  - ElevenLabs for voice output
  - JSONL long-term session memory

Run inside NemoClaw sandbox abdi or locally with VOICE_AGENT_LOCAL=true.
"""

from __future__ import annotations

import logging
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

# Ensure sibling modules resolve when launched from any cwd (sandbox exec)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from elevenlabs_client import listen, listen_or_fallback, speak
from memory import (
    DEFAULT_LOG_PATH,
    count_completed_sessions,
    get_prior_session_summary,
    load_conversation_history,
    load_full_session,
    log_event,
    new_session_id,
)
from nemo_client import ask_nemotron

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("voice_agent")

SESSION_MINUTES = int(os.getenv("VOICE_AGENT_SESSION_MINUTES", "75"))
TURN_INTERVAL_SEC = int(os.getenv("VOICE_AGENT_TURN_INTERVAL_SEC", "90"))
VOICE_USE_INPUT = os.getenv("VOICE_USE_INPUT", "true").lower() in {"1", "true", "yes"}
JUDGE_QA_MINUTES = int(os.getenv("VOICE_JUDGE_QA_MINUTES", "15"))

SYSTEM_PROMPT = (
    "You are the ReLoop AI Voice Operations Agent for the NVIDIA Hack for Impact "
    "London hackathon. You advise London businesses on circular economy decisions "
    "for electronic waste: reuse, repair, donate, resell, and recycle. "
    "Be concise, actionable, and cite environmental and economic impact when relevant. "
    "Keep responses under 120 words so they work well when spoken aloud."
)

TURN_PROMPTS: list[str] = [
    "A London company plans to dispose of 120 laptops. What should ReLoop recommend?",
    "Summarise the carbon savings from refurbishing 35 office monitors instead of landfilling them.",
    "Which destinations in London should we match 15 network switches to for maximum recovery value?",
    "Ten decommissioned servers need routing. What is the highest-value circular outcome?",
    "Give a 30-second voice briefing on ReLoop's edge-to-DGX architecture for hackathon judges.",
    "What risk checks should run before donating laptops to schools?",
    "Estimate total GBP recovery value for our demo inventory and explain your reasoning.",
    "How does London PM2.5 and NO2 data inform our environmental impact report?",
]


def _session_deadline() -> float:
    return time.time() + SESSION_MINUTES * 60


def _remaining_minutes(deadline: float) -> float:
    return max(0.0, (deadline - time.time()) / 60.0)


def run_session() -> None:
    """Main 75-minute voice agent loop."""
    deadline = _session_deadline()
    session_id = new_session_id()
    prior_count = count_completed_sessions()
    prior_summary = get_prior_session_summary()
    prior_history = load_conversation_history()

    history: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if prior_history:
        # Restore conversation memory from all previous sessions
        for turn in prior_history:
            if turn["role"] == "system":
                continue
            history.append(turn)
        logger.info("Loaded %d turns from previous sessions", len(prior_history))
        print(
            f"[ReLoop Voice Agent] Remembering {prior_count} prior session(s), "
            f"{len(prior_history)} conversation turns loaded.",
            flush=True,
        )

    if prior_summary:
        memory_note = (
            f"Memory from prior sessions: {prior_summary} "
            "Continue consistently with earlier ReLoop recommendations."
        )
        history.insert(1, {"role": "system", "content": memory_note})
        log_event("system", memory_note, session_id=session_id, meta={"type": "memory"})

    turn_index = 0

    log_event(
        "event",
        "Voice agent session started",
        session_id=session_id,
        meta={
            "duration_minutes": SESSION_MINUTES,
            "turn_interval_sec": TURN_INTERVAL_SEC,
            "prior_sessions": prior_count,
            "restored_turns": len(prior_history),
        },
    )
    logger.info(
        "=== ReLoop Voice Agent started (%s min session) ===",
        SESSION_MINUTES,
    )
    print(
        f"[ReLoop Voice Agent] Running for {SESSION_MINUTES} minutes. "
        f"Logging to {DEFAULT_LOG_PATH}",
        flush=True,
    )

    # Optional opening spoken greeting
    try:
        if prior_count > 0:
            greeting = (
                f"ReLoop voice agent online. I remember {prior_count} previous session"
                f"{'s' if prior_count != 1 else ''}. "
                "Continuing London circular economy operations."
            )
        else:
            greeting = (
                "ReLoop voice agent online. Beginning seventy-five minute circular economy "
                "operations session for London asset recovery."
            )
        speak(greeting)
        log_event("assistant", greeting, session_id=session_id, meta={"type": "greeting"})
        history.append({"role": "assistant", "content": greeting})
    except Exception as exc:
        _handle_error("opening_greeting", exc)

    while time.time() < deadline:
        remaining = _remaining_minutes(deadline)
        print(
            f"[ReLoop Voice Agent] Turn {turn_index + 1} — {remaining:.1f} min remaining",
            flush=True,
        )

        scripted = TURN_PROMPTS[turn_index % len(TURN_PROMPTS)]

        if VOICE_USE_INPUT:
            prompt, source = listen_or_fallback(scripted)
        else:
            prompt, source = scripted, "scripted"

        log_event(
            "user",
            prompt,
            session_id=session_id,
            meta={"turn": turn_index, "input_source": source},
        )
        history.append({"role": "user", "content": prompt})

        try:
            reply = ask_nemotron(prompt, history)
            log_event(
                "assistant",
                reply,
                session_id=session_id,
                meta={"turn": turn_index, "engine": "nemotron"},
            )
            history.append({"role": "assistant", "content": reply})
            logger.info("Nemotron reply (%d chars)", len(reply))
            print(f"[Nemotron] {reply[:200]}{'...' if len(reply) > 200 else ''}", flush=True)

            speak(reply)
            log_event(
                "event",
                "Spoken via ElevenLabs",
                session_id=session_id,
                meta={"turn": turn_index},
            )

        except Exception as exc:
            _handle_error(f"turn_{turn_index}", exc)

        turn_index += 1

        sleep_for = min(TURN_INTERVAL_SEC, max(0, deadline - time.time()))
        if sleep_for <= 0:
            break

        log_event(
            "event",
            f"Sleeping {int(sleep_for)}s until next turn",
            session_id=session_id,
            meta={"remaining_minutes": round(_remaining_minutes(deadline), 2)},
        )
        time.sleep(sleep_for)

    summary = (
        f"Session complete after {SESSION_MINUTES} minutes. "
        f"{turn_index} turns processed. "
        f"{len(load_full_session())} log entries recorded."
    )
    log_event(
        "event",
        summary,
        session_id=session_id,
        meta={"turns": turn_index, "ended_at": datetime.now(timezone.utc).isoformat()},
    )
    logger.info(summary)
    print(f"[ReLoop Voice Agent] {summary}", flush=True)

    try:
        speak(
            "ReLoop voice session complete. All recovery insights have been logged. "
            "Thank you for optimising London's circular economy."
        )
    except Exception as exc:
        _handle_error("closing_message", exc)

    if JUDGE_QA_MINUTES > 0:
        run_judge_qa_loop(session_id, history, minutes=JUDGE_QA_MINUTES)


def run_judge_qa_loop(
    session_id: str,
    history: list[dict[str, str]],
    *,
    minutes: int = 15,
) -> None:
    """
    Live judge Q&A: ElevenLabs voice IN → Nemotron + memory → ElevenLabs voice OUT.
    Judges can ask about earlier session events to test long-term retention.
    """
    deadline = time.time() + minutes * 60
    log_event(
        "event",
        "Judge Q&A voice mode started — ask about earlier session events",
        session_id=session_id,
        meta={"duration_minutes": minutes},
    )
    print(
        f"[ReLoop Voice Agent] Judge Q&A mode for {minutes} min — voice in/out via ElevenLabs",
        flush=True,
    )

    try:
        speak(
            "Judge question mode active. Ask me about anything from this session. "
            "For example, what did I recommend for the laptops?"
        )
    except Exception as exc:
        _handle_error("judge_qa_intro", exc)

    qa_index = 0
    while time.time() < deadline:
        remaining = _remaining_minutes(deadline)
        print(f"[Judge Q&A] Listening — {remaining:.1f} min remaining", flush=True)

        try:
            question = listen(play_ack=True)
            if not question.strip():
                continue

            log_event(
                "user",
                question,
                session_id=session_id,
                meta={"turn": qa_index, "input_source": "elevenlabs_stt", "mode": "judge_qa"},
            )
            history.append({"role": "user", "content": question})

            memory_context = get_prior_session_summary()
            enriched_history = history.copy()
            if memory_context:
                enriched_history.insert(
                    1,
                    {
                        "role": "system",
                        "content": (
                            f"Session memory for judge Q&A: {memory_context} "
                            "Answer using specific details from earlier in this session."
                        ),
                    },
                )

            reply = ask_nemotron(question, enriched_history)
            history.append({"role": "assistant", "content": reply})

            log_event(
                "assistant",
                reply,
                session_id=session_id,
                meta={"turn": qa_index, "engine": "nemotron", "mode": "judge_qa"},
            )
            print(f"[Judge Q&A Answer] {reply[:200]}", flush=True)

            speak(reply)
            log_event(
                "event",
                "Judge Q&A response spoken via ElevenLabs",
                session_id=session_id,
                meta={"turn": qa_index},
            )
            qa_index += 1

        except Exception as exc:
            _handle_error(f"judge_qa_{qa_index}", exc)

    log_event(
        "event",
        f"Judge Q&A complete — {qa_index} voice questions answered",
        session_id=session_id,
    )


def _handle_error(context: str, exc: Exception) -> None:
    """Log and print errors without crashing the session."""
    message = f"{context}: {exc}"
    logger.error(message)
    logger.debug(traceback.format_exc())
    log_event("error", message, meta={"context": context})
    print(f"[ERROR] {message}", flush=True)


if __name__ == "__main__":
    try:
        run_session()
    except KeyboardInterrupt:
        log_event("event", "Session interrupted by user")
        print("[ReLoop Voice Agent] Interrupted.", flush=True)
        sys.exit(130)
