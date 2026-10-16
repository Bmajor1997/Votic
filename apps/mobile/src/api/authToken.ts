let authTokenProvider: (() => Promise<string | null>) | null = null;

/** Registered by AuthProvider so every request to the Votic server carries the signed-in person's token. */
export function set_auth_token_provider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

export async function auth_headers(): Promise<Record<string, string>> {
  const token = await authTokenProvider?.().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
