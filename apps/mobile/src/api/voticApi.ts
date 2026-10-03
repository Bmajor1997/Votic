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
  // The timeout also covers refreshing the sign-in token, so a stalled refresh cannot hang a request.
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const auth = await authHeaders();
    if (controller.signal.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    return await fetch(url, {
      ...init,
      headers: {
        ...clientHeaders(process.env.EXPO_PUBLIC_VOTIC_CLIENT_KEY),
        ...auth,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("Votic took too long to respond. Check your connection and try again.");
    throw new Error("Votic could not connect. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
async function responseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
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
  const result = await responseJson(response);
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
  const result = await responseJson(response);
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
): Promise<VoticAnswer> {
  const response = await apiFetch("/api/help", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      document,
      ...(history.length ? { history } : {}),
      // "adaptive" is the server's default, so it is left out to keep requests unchanged for most people.
      ...(explanationStyle !== "adaptive" ? { explanationStyle } : {}),
    }),
  });
  const result = await responseJson(response);
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
