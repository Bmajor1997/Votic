const { isIP } = require("node:net");

function public_https(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || !host || host === "localhost" || /\.(local|internal)$/.test(host)) return false;
    if (isIP(host) === 6 && !/^[23][0-9a-f]{3}:/.test(host)) return false;
    if (isIP(host) === 4) {
      const [a, b] = host.split(".").map(Number);
      if ([0, 10, 127].includes(a) || a >= 224 || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127)) return false;
    }
    return true;
  } catch { return false; }
}
function validate_release_environment(env, config = {}) {
  const required = ["EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_APP_ID", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY"];
  const missing = required.filter(key => !env[key]?.trim());
  for (const key of ["EXPO_PUBLIC_VOTIC_API_URL", "EXPO_PUBLIC_VOTIC_TERMS_URL", "EXPO_PUBLIC_VOTIC_PRIVACY_URL"])
    if (!public_https(env[key])) missing.push(key);
  const projectId = env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId || "")) missing.push("EAS project ID");
  if (missing.length) throw new Error("Production configuration is missing or invalid: " + missing.join(", "));
}
module.exports = { validate_release_environment, public_https };
