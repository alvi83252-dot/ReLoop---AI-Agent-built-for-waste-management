"""Launch the voice agent inside the NemoClaw sandbox `abdi`."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import TypedDict

logger = logging.getLogger(__name__)

SANDBOX_NAME = os.getenv("NEMOCLAW_SANDBOX", "abdi")
NEMOCLAW_BIN = os.getenv("NEMOCLAW_BIN", "nemoclaw")

# Paths inside the abdi sandbox (Linux)
SANDBOX_PYTHON = os.getenv(
    "VOICE_AGENT_SANDBOX_PYTHON",
    "/home/sandbox/voice_agent/venv/bin/python3",
)
SANDBOX_SCRIPT = os.getenv(
    "VOICE_AGENT_SANDBOX_SCRIPT",
    "/home/sandbox/voice_agent/run_voice_agent.py",
)

LOCAL_SCRIPT = Path(__file__).resolve().parent / "run_voice_agent.py"


class LaunchResult(TypedDict):
    status: str
    pid: int | None
    mode: str
    command: list[str]


def start_voice_agent() -> LaunchResult:
    """
    Start the 75-minute voice agent loop.

    Default: launches inside NemoClaw sandbox `abdi` via `nemoclaw abdi exec`.
    Set VOICE_AGENT_LOCAL=true to run the script on the host (development fallback).

    Returns:
        Launch metadata including PID and command used.
    """
    if os.getenv("VOICE_AGENT_LOCAL", "").lower() in {"1", "true", "yes"}:
        return _start_local()

    cmd = [
        NEMOCLAW_BIN,
        SANDBOX_NAME,
        "exec",
        SANDBOX_PYTHON,
        SANDBOX_SCRIPT,
    ]

    logger.info("Launching voice agent in sandbox: %s", " ".join(cmd))

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    return {
        "status": "started",
        "pid": proc.pid,
        "mode": "nemoclaw_sandbox",
        "command": cmd,
    }


def _start_local() -> LaunchResult:
    """Run voice agent on the host machine (for local dev/testing)."""
    cmd = [sys.executable, str(LOCAL_SCRIPT)]
    logger.info("Launching voice agent locally: %s", " ".join(cmd))

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(LOCAL_SCRIPT.parent),
    )

    return {
        "status": "started",
        "pid": proc.pid,
        "mode": "local",
        "command": cmd,
    }
