import { createRemoteJWKSet, jwtVerify } from "jose";

// Google's public keys for Firebase ID tokens. jose caches them and refetches when Google rotates them.
const FIREBASE_KEYS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/**
 * Requires a valid Firebase ID token on every /api/ request. Resolves to { uid } for a signed-in person,
 * or false, so the server can answer 401. Public pages stay open.
 */
export function create_firebase_authorizer(project_id, { keys = createRemoteJWKSet(new URL(FIREBASE_KEYS_URL)) } = {}) {
  return async (request, path) => {
    if (!path.startsWith("/api/")) return true;
    const match = /^Bearer\s+(\S+)$/i.exec(String(request.headers.authorization || ""));
    if (!match) return false;
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        issuer: `https://securetoken.google.com/${project_id}`,
        audience: project_id,
        algorithms: ["RS256"],
      });
      return typeof payload.sub === "string" && payload.sub ? { uid: payload.sub } : false;
    } catch {
      return false;
    }
  };
}
