import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

    if (!apiKey) {
      return NextResponse.json({
        mode: "demo",
        message: "ElevenLabs API key not configured — use browser speech synthesis",
        text,
      });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { mode: "demo", message: "ElevenLabs unavailable", text },
        { status: 200 }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");

    return NextResponse.json({
      mode: "elevenlabs",
      audio: `data:audio/mpeg;base64,${base64}`,
      text,
    });
  } catch {
    return NextResponse.json({ mode: "demo", message: "Voice fallback active" });
  }
}
