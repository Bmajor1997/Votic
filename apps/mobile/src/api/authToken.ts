let authTokenProvider: (() => Promise<string | null>) | null = null;

/** Registered by AuthProvider so every request to the Votic server carries the signed-in person's token. */
export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await authTokenProvider?.().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
