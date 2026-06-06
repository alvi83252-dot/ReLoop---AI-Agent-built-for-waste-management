"""ElevenLabs voice input (STT) and output (TTS)."""

from __future__ import annotations

import io
import logging
import os
import tempfile
from typing import Final

logger = logging.getLogger(__name__)

DEFAULT_VOICE_ID: Final[str] = "EXAVITQu4vr4xnSDxMaL"
DEFAULT_TTS_MODEL: Final[str] = "eleven_turbo_v2_5"
DEFAULT_STT_MODEL: Final[str] = "scribe_v2"
DEFAULT_LISTEN_SECONDS: Final[float] = 8.0
DEFAULT_SAMPLE_RATE: Final[int] = 16000


def _get_api_key() -> str:
    key = (
        os.getenv("ELEVEN_API_KEY", "").strip()
        or os.getenv("ELEVENLABS_API_KEY", "").strip()
    )
    if not key:
        raise RuntimeError(
            "ELEVEN_API_KEY is not set. Export it before running the voice agent."
        )
    return key


def _get_voice_id() -> str:
    return (
        os.getenv("ELEVEN_VOICE_ID", "").strip()
        or os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID).strip()
        or DEFAULT_VOICE_ID
    )


def _get_client():
    from elevenlabs.client import ElevenLabs

    return ElevenLabs(api_key=_get_api_key())


# ── OUTPUT: Text → ElevenLabs TTS → speakers ────────────────────────────────


def speak(text: str) -> None:
    """Synthesize text with ElevenLabs and play audio locally."""
    if not text.strip():
        logger.warning("speak() called with empty text — skipping")
        return

    client = _get_client()
    voice_id = _get_voice_id()
    model_id = os.getenv("ELEVEN_MODEL_ID", DEFAULT_TTS_MODEL)

    logger.info("TTS output via ElevenLabs (voice=%s)", voice_id)

    audio_generator = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id=model_id,
    )

    audio_bytes = b"".join(audio_generator)
    if not audio_bytes:
        raise RuntimeError("ElevenLabs TTS returned empty audio")

    _play_audio(audio_bytes)


def _play_audio(audio_bytes: bytes) -> None:
    try:
        import sounddevice as sd
        import soundfile as sf

        data, samplerate = sf.read(io.BytesIO(audio_bytes))
        sd.play(data, samplerate)
        sd.wait()
        return
    except Exception as exc:
        logger.warning("sounddevice playback failed (%s) — saving temp file", exc)

    path = _write_temp_audio(audio_bytes, suffix=".mp3")
    logger.info("Audio saved to %s", path)


def _write_temp_audio(audio_bytes: bytes, suffix: str = ".mp3") -> str:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        return tmp.name


# ── INPUT: Microphone → ElevenLabs STT → text ───────────────────────────────


def record_audio(
    duration_sec: float | None = None,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> bytes:
    """Record from the default microphone and return WAV bytes."""
    duration = duration_sec or float(os.getenv("VOICE_LISTEN_SECONDS", DEFAULT_LISTEN_SECONDS))

    try:
        import sounddevice as sd
        import soundfile as sf
    except ImportError as exc:
        raise RuntimeError(
            "sounddevice/soundfile required for voice input. "
            "Install with: pip install sounddevice soundfile"
        ) from exc

    logger.info("Recording microphone for %.1fs...", duration)
    frames = sd.rec(
        int(duration * sample_rate),
        samplerate=sample_rate,
        channels=1,
        dtype="float32",
    )
    sd.wait()

    buffer = io.BytesIO()
    sf.write(buffer, frames, sample_rate, format="WAV")
    return buffer.getvalue()


def transcribe(audio_bytes: bytes) -> str:
    """Transcribe audio bytes using ElevenLabs Speech-to-Text (Scribe)."""
    if not audio_bytes:
        return ""

    client = _get_client()
    model_id = os.getenv("ELEVEN_STT_MODEL", DEFAULT_STT_MODEL)

    logger.info("STT input via ElevenLabs (model=%s)", model_id)

    result = client.speech_to_text.convert(
        file=io.BytesIO(audio_bytes),
        model_id=model_id,
        language_code=os.getenv("ELEVEN_STT_LANGUAGE", "eng"),
    )

    text = getattr(result, "text", None) or str(result)
    return text.strip()


def listen(
    duration_sec: float | None = None,
    *,
    play_ack: bool = False,
) -> str:
    """
    Full voice INPUT pipeline: record microphone → ElevenLabs STT → text.

    Args:
        duration_sec: How long to listen (seconds).
        play_ack: If True, speak a short "Listening" cue first (TTS output).

    Returns:
        Transcribed text, or empty string if nothing detected.
    """
    if play_ack:
        speak("Listening.")

    audio_bytes = record_audio(duration_sec)
    text = transcribe(audio_bytes)

    if text:
        logger.info("Heard: %s", text[:120])
    else:
        logger.info("No speech detected")

    return text


def listen_or_fallback(fallback: str, duration_sec: float | None = None) -> tuple[str, str]:
    """
    Try voice input first; use fallback prompt if silence or STT fails.

    Returns:
        (prompt_text, source) where source is 'elevenlabs_stt' or 'scripted'
    """
    try:
        heard = listen(duration_sec, play_ack=True)
        if heard.strip():
            return heard.strip(), "elevenlabs_stt"
    except Exception as exc:
        logger.warning("Voice input failed, using scripted prompt: %s", exc)

    return fallback, "scripted"
