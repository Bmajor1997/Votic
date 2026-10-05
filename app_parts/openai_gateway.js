import { createHash } from "node:crypto";
import { model_prices } from "./ai_usage.js";

export function response_text(result) {
  if (Array.isArray(result.output)) return result.output
    .filter((item) => item.type === "message" && item.role === "assistant")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text).join("\n").trim();
  // Also accept SDK-shaped results in adapters and test doubles.
  return typeof result.output_text === "string" ? result.output_text.trim() : "";
}

/** All paid requests use the same ledger. Reserve before sending; retain uncertain charges on timeout.
 * Deliberately no automatic retry: a timeout may already have spent tokens at the provider.
 */
export function accounted_fetch({ fetch_impl, store, env, user_id, feature }) {
  return async (url, options) => {
    const transcription = url === "https://api.openai.com/v1/audio/transcriptions";
    if (!transcription && url !== "https://api.openai.com/v1/responses") throw new Error("Unsupported AI endpoint");
    const payload = transcription ? null : JSON.parse(options.body);
    const model = transcription ? options.body.get("model") : payload.model;
    const rates = model_prices(model, env);
    if (payload) {
      payload.store = false;
      payload.service_tier = "default";
      if (model.startsWith("gpt-6-")) payload.reasoning = { effort: "none" };
      payload.safety_identifier = createHash("sha256").update(user_id).digest("hex");
    }
    // UTF-8 bytes are a conservative text token bound. Images retain their encoded size bound.
    // A short transcription is bounded by the model's 16K context / 2K max output.
    const input_bound = transcription ? 16000 : Math.max(feature === "scan-ocr" ? 50000 : 0, Buffer.byteLength(JSON.stringify(payload), "utf8") + 1024);
    const output_bound = transcription ? 2000 : payload.max_output_tokens;
    const request_id = store.reserve({ user_id, feature, model, input_bound, output_bound, rates });
    let finished = false;
    try {
      const response = await fetch_impl(url, {
        ...options,
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        headers: { ...options.headers, "X-Client-Request-Id": request_id },
      });
      const provider_request_id = response.headers?.get?.("x-request-id") || null;
      if (!response.ok) {
        // 4xx is a provider rejection. 5xx may have spent tokens: retain the reservation.
        store.finish(request_id, { status: "provider-error", provider_request_id, rejected: response.status >= 400 && response.status < 500 });
        finished = true;
        throw new Error("AI unavailable");
      }
      const result = await response.json();
      const status = result.status === "incomplete" || result.status === "failed" ? result.status : "completed";
      store.finish(request_id, { status, result, provider_request_id });
      finished = true;
      if (status !== "completed") throw new Error("AI response did not complete");
      return { ok: true, status: response.status, json: async () => ({ ...result, output_text: response_text(result) }) };
    } catch (error) {
      if (!finished) store.finish(request_id, { status: "unknown" });
      throw error;
    }
  };
}

/** V1 voice foundation: PCM WAV only, duration derived from bytes rather than a client claim.
 * Reject compressed containers until a trusted decoder can validate duration and expansion limits.
 */
export function validate_voice_wav(bytes, max_seconds = 60) {
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE" || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error("Record a valid PCM WAV voice question.");
  let format, data_bytes = 0, data_chunks = 0, offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(offset + 4), end = offset + 8 + size, id = bytes.toString("ascii", offset, offset + 4);
    if (end > bytes.length) throw new Error("The voice recording is damaged.");
    if (id === "fmt ") {
      if (format || size < 16) throw new Error("The voice recording has an invalid format.");
      format = { codec: bytes.readUInt16LE(offset + 8), channels: bytes.readUInt16LE(offset + 10), rate: bytes.readUInt32LE(offset + 12), byte_rate: bytes.readUInt32LE(offset + 16), align: bytes.readUInt16LE(offset + 20), bits: bytes.readUInt16LE(offset + 22) };
    }
    if (id === "data") { data_bytes += size; data_chunks += 1; }
    offset = end + (size % 2);
  }
  if (offset !== bytes.length || !format || format.codec !== 1 || ![1, 2].includes(format.channels) || format.bits !== 16 || format.rate < 8000 || format.rate > 48000 || format.align !== format.channels * 2 || format.byte_rate !== format.rate * format.align || data_chunks !== 1 || !data_bytes || data_bytes % format.align) throw new Error("Use a 16-bit PCM WAV recording at 8–48 kHz.");
  const seconds = data_bytes / format.byte_rate;
  if (seconds > max_seconds) throw new Error(`Keep voice questions under ${max_seconds} seconds.`);
  return seconds;
}

export async function transcribe_voice(bytes, { env, fetch_impl, timeout_ms }) {
  const form = new FormData();
  form.set("model", "gpt-4o-mini-transcribe");
  form.set("response_format", "json");
  form.set("file", new Blob([bytes], { type: "audio/wav" }), "voice-question.wav");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const response = await fetch_impl("https://api.openai.com/v1/audio/transcriptions", { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form });
    if (!response.ok) throw new Error("Transcription unavailable");
    const result = await response.json();
    if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 1000) throw new Error("Invalid voice question");
    return result.text.trim();
  } finally { clearTimeout(timer); }
}
