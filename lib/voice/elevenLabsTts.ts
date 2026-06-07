import https from "node:https";

/** HTTPS TTS request using system-friendly TLS (Windows / corporate proxies). */
export function elevenLabsTts(
  voiceId: string,
  apiKey: string,
  text: string,
  modelId: string
): Promise<Buffer> {
  const body = JSON.stringify({ text, model_id: modelId });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.elevenlabs.io",
        path: `/v1/text-to-speech/${voiceId}`,
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "xi-api-key": apiKey,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buffer);
            return;
          }
          reject(
            new Error(
              `ElevenLabs HTTP ${res.statusCode}: ${buffer.toString("utf8").slice(0, 300)}`
            )
          );
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export function synthesizeVoiceResponse(
  apiKey: string,
  voiceId: string,
  modelId: string,
  text: string
): Promise<{ mode: "elevenlabs"; audio: string } | { mode: "browser"; text: string; message: string }> {
  return elevenLabsTts(voiceId, apiKey, text, modelId)
    .then((buffer) => ({
      mode: "elevenlabs" as const,
      audio: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
    }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : "ElevenLabs TTS failed";
      const freeTierBlocked = message.includes("detected_unusual_activity");
      return {
        mode: "browser" as const,
        text,
        message: freeTierBlocked
          ? "ElevenLabs free tier blocked — using browser voice."
          : `ElevenLabs unavailable — using browser voice (${message.slice(0, 80)}).`,
      };
    });
}
