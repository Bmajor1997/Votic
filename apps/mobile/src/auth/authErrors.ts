/** A sign-in the person chose to back out of. Callers stay quiet instead of showing an error. */
export class SignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled.");
    this.name = "SignInCancelled";
  }
}

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/weak-password": "Use at least 8 characters, including a letter and a number.",
  "auth/email-already-in-use": "An account already uses this email. Sign in instead.",
  "auth/invalid-credential": "That email and password don't match. Try again or reset your password.",
  "auth/wrong-password": "That email and password don't match. Try again or reset your password.",
  "auth/user-not-found": "That email and password don't match. Try again or reset your password.",
  "auth/user-disabled": "This account has been turned off. Contact Votic support for help.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, then try again.",
  "auth/network-request-failed": "Votic couldn't connect. Check your connection and try again.",
  "auth/account-exists-with-different-credential":
    "This email already has a Votic account. Sign in the way you did before.",
  "auth/requires-recent-login": "For your security, sign out and sign back in, then try again.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on for Votic yet.",
};

/** A short, plain explanation of an authentication failure. Never exposes raw provider codes. */
export function authErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  if (MESSAGES[code]) return MESSAGES[code];
  if (error instanceof Error && error.name === "VoticAuthUnavailable") return error.message;
  return "Votic couldn't sign you in right now. Please try again.";
}

/** Checks a new password before it is sent, so people see the rule while typing rather than after a round trip. */
export function passwordProblem(password: string) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/i.test(password)) return "Include at least one letter.";
  if (!/\d/.test(password)) return "Include at least one number.";
  return null;
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
