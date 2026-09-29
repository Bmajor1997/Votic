const DEVELOPMENT_PORT = 4173;
export const MISSING_API_URL_MESSAGE = "This version of Votic isn't connected to a Votic server yet.";
export const INSECURE_API_URL_MESSAGE = "This version of Votic is set up with an insecure server address.";

type ApiUrlInput = { isDevelopment: boolean; configuredUrl?: string; developmentHostUri?: string };

/**
 * Release builds only talk to the configured HTTPS server. Development builds may fall back to the
 * computer running Expo, so a phone on the same network reaches the local Votic server.
 */
export function resolveApiUrl({ isDevelopment, configuredUrl, developmentHostUri }: ApiUrlInput) {
  const configured = configuredUrl?.trim().replace(/\/+$/, "");
  if (configured) {
    if (!isDevelopment && !/^https:\/\//i.test(configured)) throw new Error(INSECURE_API_URL_MESSAGE);
    return configured;
  }
  if (!isDevelopment) throw new Error(MISSING_API_URL_MESSAGE);
  const host = developmentHostUri?.replace(/^https?:\/\//, "").split(":")[0];
  return `http://${host || "localhost"}:${DEVELOPMENT_PORT}`;
}

/** Headers identifying this app to the server. The key is not a secret; it filters casual abuse. */
export function clientHeaders(clientKey?: string): Record<string, string> {
  const key = clientKey?.trim();
  return key ? { "X-Votic-Client-Key": key } : {};
}
