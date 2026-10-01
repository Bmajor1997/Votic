import { describe, expect, it } from "vitest";
import { authErrorFromCode, hasErrors, validateCreateAccount, validateSignIn } from "./authValidation";

const valid = {
  firstName: "Sam",
  email: "sam@example.com",
  password: "reading123",
  confirmPassword: "reading123",
};

describe("create account validation", () => {
  it("accepts a complete form", () => {
    expect(hasErrors(validateCreateAccount(valid))).toBe(false);
  });
  it("explains each missing or invalid field", () => {
    const errors = validateCreateAccount({
      firstName: " ",
      email: "sam@",
      password: "short",
      confirmPassword: "",
    });
    expect(errors).toEqual({
      firstName: "Enter your first name.",
      email: "Enter a valid email address, like name@example.com.",
      password: "Use at least 8 characters.",
      confirmPassword: "Enter your password again.",
    });
  });
  it("requires a letter and a number, and matching confirmation", () => {
    expect(
      validateCreateAccount({ ...valid, password: "readingonly", confirmPassword: "readingonly" }).password,
    ).toBe("Include at least one letter and one number.");
    expect(validateCreateAccount({ ...valid, confirmPassword: "reading124" }).confirmPassword).toBe(
      "Passwords don't match.",
    );
  });
});

describe("sign in validation", () => {
  it("needs an email and a password", () => {
    expect(validateSignIn({ email: "", password: "" })).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });
});

describe("account error messages", () => {
  it("never reveals whether an email has an account", () => {
    const messages = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/user-disabled",
    ].map((code) => authErrorFromCode(code).message);
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe("That email and password don't match. Check them and try again.");
  });
  it("gives a generic message for anything unexpected", () => {
    expect(authErrorFromCode("auth/internal-error").message).toBe("Something went wrong. Please try again.");
    expect(authErrorFromCode(undefined).reason).toBe("unknown");
  });
});
