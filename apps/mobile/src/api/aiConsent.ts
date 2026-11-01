export const AI_CONSENT_VERSION = "openai-v1";
export const AI_CONTENT_PATHS = [
  "/api/help",
  "/api/review",
  "/api/scan",
  "/api/extract",
  "/api/transcribe-question",
];
let consent: ((signal?: AbortSignal) => Promise<boolean>) | null = null;
/** Installed by the mounted account UI. An absent disclosure UI always fails closed. */
export function register_ai_consent(handler: ((signal?: AbortSignal) => Promise<boolean>) | null) {
  consent = handler;
}
export async function require_ai_consent(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error("Request canceled."), { name: "AbortError" });
  const allowed = consent ? await consent(signal) : false;
  if (signal?.aborted) throw Object.assign(new Error("Request canceled."), { name: "AbortError" });
  if (!allowed)
    throw new Error("AI sharing was declined. Nothing was sent. You can still read saved documents.");
}
