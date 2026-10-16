import { describe, expect, it } from "vitest";
import { auth_error_message, looks_like_email, password_problem, PASSWORD_REQUIREMENTS } from "./authErrors";

describe("auth_error_message", () => {
  it("explains common Firebase errors in plain words", () => {
    expect(auth_error_message({ code: "auth/email-already-in-use" })).toBe(
      "An account already uses this email. Sign in instead.",
    );
    expect(auth_error_message({ code: "auth/network-request-failed" })).toMatch(/couldn't connect/);
  });

  it("gives the same answer for a wrong password and an unknown email, so it never reveals who has an account", () => {
    const wrongPassword = auth_error_message({ code: "auth/wrong-password" });
    expect(auth_error_message({ code: "auth/user-not-found" })).toBe(wrongPassword);
    expect(auth_error_message({ code: "auth/invalid-credential" })).toBe(wrongPassword);
  });

  it("never shows a raw provider code or message", () => {
    const message = auth_error_message(
      Object.assign(new Error("Firebase: internal (auth/internal-error)."), { code: "auth/internal-error" }),
    );
    expect(message).toBe("Votic couldn't sign you in right now. Please try again.");
  });

  it("passes through Votic's own setup messages", () => {
    const error = Object.assign(new Error("Sign-in isn't set up in this build of Votic yet."), {
      name: "VoticAuthUnavailable",
    });
    expect(auth_error_message(error)).toBe("Sign-in isn't set up in this build of Votic yet.");
  });
});

describe("new account checks", () => {
  it("requires 8+ characters, uppercase, lowercase, a number, and a symbol", () => {
    expect(password_problem("short1")).toBe("Use at least 8 characters.");
    expect(password_problem("reading1!")).toBe("Include at least one uppercase letter.");
    expect(password_problem("READING1!")).toBe("Include at least one lowercase letter.");
    expect(password_problem("Reading!!")).toBe("Include at least one number.");
    expect(password_problem("Reading1")).toBe("Include at least one symbol (for example, !, @, or #).");
    expect(password_problem("Read1ng!")).toBeNull();
  });

  it("does not treat whitespace or non-ASCII letters as symbols", () => {
    expect(password_problem("Reading1 ")).not.toBeNull();
    expect(password_problem("Reading1é")).not.toBeNull();
    expect(password_problem("Reading1#")).toBeNull();
    expect(password_problem("Reading1_")).toBeNull();
  });

  it("uses the same requirements when the provider rejects a password", () => {
    expect(auth_error_message({ code: "auth/weak-password" })).toBe(PASSWORD_REQUIREMENTS);
    expect(auth_error_message({ code: "auth/password-does-not-meet-requirements" })).toBe(
      PASSWORD_REQUIREMENTS,
    );
  });

  it("recognizes email addresses", () => {
    expect(looks_like_email(" reader@example.com ")).toBe(true);
    expect(looks_like_email("reader@example")).toBe(false);
    expect(looks_like_email("reader example.com")).toBe(false);
  });
});
