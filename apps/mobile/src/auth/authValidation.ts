import { AuthError } from "./authTypes";

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateAccountFields = {
  firstName: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function emailError(email: string) {
  const value = email.trim();
  if (!value) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address, like name@example.com.";
  return undefined;
}

export function validateCreateAccount(fields: CreateAccountFields): FieldErrors<CreateAccountFields> {
  const errors: FieldErrors<CreateAccountFields> = {};
  const firstName = fields.firstName.trim();
  if (!firstName) errors.firstName = "Enter your first name.";
  else if (firstName.length > 50) errors.firstName = "Use 50 characters or fewer.";
  const email = emailError(fields.email);
  if (email) errors.email = email;
  if (!fields.password) errors.password = "Create a password.";
  else if (fields.password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (fields.password.length > 128) errors.password = "Use 128 characters or fewer.";
  else if (!/[A-Za-z]/.test(fields.password) || !/[0-9]/.test(fields.password))
    errors.password = "Include at least one letter and one number.";
  if (!fields.confirmPassword) errors.confirmPassword = "Enter your password again.";
  else if (fields.confirmPassword !== fields.password) errors.confirmPassword = "Passwords don't match.";
  return errors;
}

export function validateSignIn(fields: { email: string; password: string }) {
  const errors: FieldErrors<{ email: string; password: string }> = {};
  const email = emailError(fields.email);
  if (email) errors.email = email;
  if (!fields.password) errors.password = "Enter your password.";
  return errors;
}

export function hasErrors(errors: object) {
  return Object.values(errors).some(Boolean);
}

/**
 * Turns a Firebase Auth error code into a message that is safe to show. Wrong password, unknown email,
 * and disabled accounts share one message so the app never reveals which emails have accounts.
 */
export function authErrorFromCode(code: string | undefined): AuthError {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/user-disabled":
      return new AuthError(
        "That email and password don't match. Check them and try again.",
        "invalid-credentials",
      );
    case "auth/email-already-in-use":
      return new AuthError(
        "This email can't be used to create a new account. If it's yours, sign in or reset your password.",
        "email-in-use",
      );
    case "auth/weak-password":
      return new AuthError("Choose a stronger password.", "weak-password");
    case "auth/invalid-email":
      return new AuthError("Enter a valid email address, like name@example.com.", "invalid-email");
    case "auth/too-many-requests":
      return new AuthError("Too many attempts. Wait a few minutes, then try again.", "too-many-requests");
    case "auth/network-request-failed":
      return new AuthError("Votic couldn't connect. Check your connection and try again.", "network");
    case "auth/requires-recent-login":
      return new AuthError(
        "For your security, confirm your password and try again.",
        "requires-recent-login",
      );
    default:
      return new AuthError("Something went wrong. Please try again.", "unknown");
  }
}
