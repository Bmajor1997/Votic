import Constants from "expo-constants";
import { clientHeaders, resolveApiUrl } from "./apiConfig";
import { authHeaders } from "./authToken";

const API_TIMEOUT_MS = 20_000;
function developmentHostUri(constants: typeof Constants = Constants) {
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
export function voticApiUrl() {
  return resolveApiUrl({
    isDevelopment: __DEV__,
    configuredUrl: process.env.EXPO_PUBLIC_VOTIC_API_URL,
    developmentHostUri: developmentHostUri(),
  });
}

async function apiFetch(path: string, init: RequestInit, timeoutMs = API_TIMEOUT_MS) {
  const url = voticApiUrl() + path;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    }, timeoutMs);
  });
  // Race the whole operation: refreshing credentials and reading the body must also finish in time.
  const request = async () => {
    const auth = await authHeaders();
    if (controller.signal.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    const response = await fetch(url, {
      ...init,
      headers: {
        ...clientHeaders(process.env.EXPO_PUBLIC_VOTIC_CLIENT_KEY),
        ...auth,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, result };
  };
  try {
    return await Promise.race([request(), timeout]);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("Votic took too long to respond. Check your connection and try again.");
    throw new Error("Votic could not connect. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
function serverError(result: Record<string, unknown>, fallback: string) {
  return typeof result.error === "string" && result.error.trim() ? result.error : fallback;
}

export async function extractDocument(name: string, bytes: ArrayBuffer) {
  const response = await apiFetch(
    "/api/extract",
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent(name) },
      body: bytes,
    },
    30_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(serverError(result, "Votic could not read this document."));
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("This document does not contain readable text.");
  return result.text;
}

export async function scanDocumentImage(name: string, bytes: ArrayBuffer) {
  const response = await apiFetch(
    "/api/scan",
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Votic-Filename": encodeURIComponent(name) },
      body: bytes,
    },
    45_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(serverError(result, "Votic could not read this scanned page."));
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
export type ExplanationStyle = "quick" | "simple" | "detailed" | "adaptive";
export async function askVotic(
  question: string,
  document?: { title: string; sections: { heading: string; text: string }[] },
  history: { role: "user" | "assistant"; text: string }[] = [],
  explanationStyle: ExplanationStyle = "adaptive",
  feature: "ask-votic" | "catch-me-up" = "ask-votic",
): Promise<VoticAnswer> {
  const response = await apiFetch("/api/help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      ...(feature !== "ask-votic" ? { feature } : {}),
      document,
      ...(history.length ? { history } : {}),
      // "adaptive" is the server's default, so it is left out to keep requests unchanged for most people.
      ...(explanationStyle !== "adaptive" ? { explanationStyle } : {}),
    }),
  });
  const result = response.result;
  if (!response.ok) throw new Error(serverError(result, "Votic could not answer right now."));
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
export async function transcribeVoiceQuestion(bytes: ArrayBuffer): Promise<string> {
  const response = await apiFetch(
    "/api/transcribe-question",
    {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: bytes,
    },
    45_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(serverError(result, "Votic could not transcribe this voice question."));
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 1000)
    throw new Error("Try a shorter voice question, or type it instead.");
  return result.text.trim();
}

export async function importWebPage(url: string): Promise<ImportedWebPage> {
  const response = await apiFetch(
    "/api/import-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    },
    30_000,
  );
  const result = response.result;
  if (!response.ok) throw new Error(serverError(result, "Votic could not import that webpage."));
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error("Votic could not find readable text on that webpage.");
  return {
    title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : "Web article",
    text: result.text.trim(),
    url: typeof result.url === "string" ? result.url : url.trim(),
  };
}
