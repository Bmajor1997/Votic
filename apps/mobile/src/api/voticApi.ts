import Constants from "expo-constants";
import { client_headers, resolve_api_url } from "./apiConfig";
import { auth_headers } from "./authToken";

import { assert_help_request_size, help_request_body, type ExplanationStyle } from "./helpRequest";
export type { ExplanationStyle } from "./helpRequest";

const API_TIMEOUT_MS = 20_000;
function development_host_uri(constants: typeof Constants = Constants) {
  const legacy = constants as typeof Constants & {
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };
  return (
    constants.expoConfig?.hostUri ||
    legacy.expoGoConfig?.debuggerHost ||
    legacy.manifest2?.extra?.expoClient?.hostUri
  );
}
export function votic_api_url() {
  return resolve_api_url({
    isDevelopment: __DEV__,
    configuredUrl: process.env.EXPO_PUBLIC_VOTIC_API_URL,
    developmentHostUri: development_host_uri(),
  });
}

async function api_fetch(
  path: string,
  init: RequestInit,
  timeoutMs = API_TIMEOUT_MS,
  signal?: AbortSignal,
  requireSignIn = false,
) {
  const url = votic_api_url() + path;
  const controller = new AbortController();
  let reject_cancellation: (error: Error) => void = () => {};
  const cancellation = new Promise<never>((_resolve, reject) => {
    reject_cancellation = reject;
  });
  const abort = () => {
    controller.abort();
    reject_cancellation(Object.assign(new Error("Aborted"), { name: "AbortError" }));
  };
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    }, timeoutMs);
  });
  // Race the whole operation: refreshing credentials and reading the body must also finish in time.
  const request = async () => {
    const auth = await auth_headers();
    if (requireSignIn && !auth.Authorization) throw new Error("Sign in to use voice questions.");
    if (controller.signal.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const response = await fetch(url, {
      ...init,
      headers: {
        ...client_headers(process.env.EXPO_PUBLIC_VOTIC_CLIENT_KEY),
        ...auth,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, result };
  };
  try {
    return await Promise.race([request(), timeout, cancellation]);
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error("Voice input canceled."), { name: "AbortError" });
    if (error instanceof Error && error.message === "Sign in to use voice questions.") throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("Votic took too long to respond. Check your connection and try again.");
    throw new Error("Votic could not connect. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
function server_error(result: Record<string, unknown>, fallback: string) {
  return typeof result.error === "string" && result.error.trim() ? result.error : fallback;
}

export async function extract_document(name: string, bytes: ArrayBuffer) {
  const response = await api_fetch(
    "/api/extract",
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent(name) },
      body: bytes,
    },
    180_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(server_error(result, "Votic could not read this document."));
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("This document does not contain readable text.");
  return result.text;
}

export async function scan_document_image(name: string, bytes: ArrayBuffer) {
  const response = await api_fetch(
    "/api/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent(name) },
      body: bytes,
    },
    45_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(server_error(result, "Votic could not read this scanned page."));
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("Votic could not find readable text in this scanned page.");
  return result.text.trim();
}

export type VoticAnswer = {
  answer: string;
  mode: string;
  sectionIndex: number | null;
  sectionTitle: string | null;
};
export async function ask_votic(
  question: string,
  document?: { title: string; sections: { heading: string; text: string }[] },
  history: { role: "user" | "assistant"; text: string }[] = [],
  explanationStyle: ExplanationStyle = "adaptive",
  feature: "ask-votic" | "catch-me-up" = "ask-votic",
): Promise<VoticAnswer> {
  const body = help_request_body(question, document, history, explanationStyle, feature);
  assert_help_request_size(body);
  const response = await api_fetch("/api/help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const result = response.result;
  if (!response.ok) throw new Error(server_error(result, "Votic could not answer right now."));
  if (typeof result.answer !== "string" || !result.answer.trim())
    throw new Error("Votic returned an empty answer.");
  return {
    answer: result.answer.trim(),
    mode: String(result.mode || "built-in"),
    sectionIndex: Number.isInteger(result.sectionIndex) ? (result.sectionIndex as number) : null,
    sectionTitle: typeof result.sectionTitle === "string" ? result.sectionTitle : null,
  };
}

export type ImportedWebPage = { title: string; text: string; url: string };
/** Foundation for a recorder: caller obtains consent and records <=60 s PCM WAV.
 * The transcript can be edited before submitting it through askVotic. Spoken output stays on device TTS.
 */
export async function check_voice_question_availability(signal?: AbortSignal): Promise<void> {
  const response = await api_fetch(
    "/api/voice-question-status",
    { method: "POST" },
    API_TIMEOUT_MS,
    signal,
    true,
  );
  if (!response.ok)
    throw new Error(server_error(response.result, "Voice questions are unavailable on this Votic server."));
  if (response.result.ready !== true) throw new Error("Update the Votic server to enable voice questions.");
}

export async function transcribe_voice_question(bytes: ArrayBuffer, signal?: AbortSignal): Promise<string> {
  const response = await api_fetch(
    "/api/transcribe-question",
    {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: bytes,
    },
    45_000,
    signal,
    true,
  );
  const result = response.result;
  if (!response.ok) throw new Error(server_error(result, "Votic could not transcribe this voice question."));
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 1000)
    throw new Error("Try a shorter voice question, or type it instead.");
  return result.text.trim();
}

export async function import_web_page(url: string): Promise<ImportedWebPage> {
  const response = await api_fetch(
    "/api/import-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    },
    30_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(server_error(result, "Votic could not import that webpage."));
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("Votic could not find readable text on that webpage.");
  return {
    title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : "Web article",
    text: result.text.trim(),
    url: typeof result.url === "string" ? result.url : url.trim(),
  };
}
