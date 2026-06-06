/**
 * Unified ElevenLabs env vars — supports both naming conventions.
 * Next.js loads: .env.local, .env (not .env.example).
 */

export function getElevenLabsConfig() {
  const apiKey =
    process.env.ELEVEN_API_KEY?.trim() ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    "";

  const voiceId =
    process.env.ELEVEN_VOICE_ID?.trim() ||
    process.env.ELEVENLABS_VOICE_ID?.trim() ||
    "EXAVITQu4vr4xnSDxMaL"; // Sarah — works on ElevenLabs free API tier

  const modelId =
    process.env.ELEVEN_MODEL_ID?.trim() || "eleven_turbo_v2_5";

  return { apiKey, voiceId, modelId };
}
