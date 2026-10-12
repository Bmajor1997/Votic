import { describe, expect, it } from "vitest";
import { auth_error_message, looks_like_email, password_problem } from "./authErrors";

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
  it("asks for 8+ characters with a letter and a number", () => {
    expect(password_problem("short1")).toBe("Use at least 8 characters.");
    expect(password_problem("12345678")).toBe("Include at least one letter.");
    expect(password_problem("abcdefgh")).toBe("Include at least one number.");
    expect(password_problem("reading1")).toBeNull();
  });

  it("recognizes email addresses", () => {
    expect(looks_like_email(" reader@example.com ")).toBe(true);
    expect(looks_like_email("reader@example")).toBe(false);
    expect(looks_like_email("reader example.com")).toBe(false);
  });
});
