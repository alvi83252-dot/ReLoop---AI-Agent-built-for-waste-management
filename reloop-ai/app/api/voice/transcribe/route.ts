import { NextResponse } from "next/server";
import https from "node:https";
import { getElevenLabsConfig } from "@/lib/env/elevenlabs";

export const runtime = "nodejs";

function transcribeWithElevenLabs(
  apiKey: string,
  audioBuffer: Buffer,
  filename: string
): Promise<string> {
  const boundary = `----ReLoop${Date.now()}`;
  const modelId = process.env.ELEVEN_STT_MODEL ?? "scribe_v2";

  const preamble =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model_id"\r\n\r\n${modelId}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language_code"\r\n\r\neng\r\n`;

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`;

  const closing = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(preamble),
    Buffer.from(fileHeader),
    audioBuffer,
    Buffer.from(closing),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.elevenlabs.io",
        path: "/v1/speech-to-text",
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(raw) as { text?: string };
              resolve(parsed.text?.trim() ?? raw);
            } catch {
              resolve(raw.trim());
            }
            return;
          }
          reject(new Error(`ElevenLabs STT HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** POST multipart audio → ElevenLabs STT → transcribed text */
export async function POST(req: Request) {
  try {
    const { apiKey } = getElevenLabsConfig();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVEN_API_KEY not configured in .env.local" },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const file = form.get("audio");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing audio file in form field 'audio'" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file instanceof File ? file.name : "recording.webm";
    const text = await transcribeWithElevenLabs(apiKey, buffer, filename);

    return NextResponse.json({ text, source: "elevenlabs_stt" });
  } catch (error) {
    console.error("STT error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
