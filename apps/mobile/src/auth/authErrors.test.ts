import { describe, expect, it } from "vitest";
import { authErrorMessage, looksLikeEmail, passwordProblem } from "./authErrors";

describe("authErrorMessage", () => {
  it("explains common Firebase errors in plain words", () => {
    expect(authErrorMessage({ code: "auth/email-already-in-use" })).toBe(
      "An account already uses this email. Sign in instead.",
    );
    expect(authErrorMessage({ code: "auth/network-request-failed" })).toMatch(/couldn't connect/);
  });

  it("gives the same answer for a wrong password and an unknown email, so it never reveals who has an account", () => {
    const wrongPassword = authErrorMessage({ code: "auth/wrong-password" });
    expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(wrongPassword);
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toBe(wrongPassword);
  });

  it("never shows a raw provider code or message", () => {
    const message = authErrorMessage(
      Object.assign(new Error("Firebase: internal (auth/internal-error)."), { code: "auth/internal-error" }),
    );
    expect(message).toBe("Votic couldn't sign you in right now. Please try again.");
  });

  it("passes through Votic's own setup messages", () => {
    const error = Object.assign(new Error("Sign-in isn't set up in this build of Votic yet."), {
      name: "VoticAuthUnavailable",
    });
    expect(authErrorMessage(error)).toBe("Sign-in isn't set up in this build of Votic yet.");
  });
});

describe("new account checks", () => {
  it("asks for 8+ characters with a letter and a number", () => {
    expect(passwordProblem("short1")).toBe("Use at least 8 characters.");
    expect(passwordProblem("12345678")).toBe("Include at least one letter.");
    expect(passwordProblem("abcdefgh")).toBe("Include at least one number.");
    expect(passwordProblem("reading1")).toBeNull();
  });

  it("recognizes email addresses", () => {
    expect(looksLikeEmail(" reader@example.com ")).toBe(true);
    expect(looksLikeEmail("reader@example")).toBe(false);
    expect(looksLikeEmail("reader example.com")).toBe(false);
  });
});
