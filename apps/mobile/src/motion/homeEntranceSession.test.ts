import { expect, it } from "vitest";
import { create_home_entrance_session } from "./homeEntranceSession";
it("arms one claim after a new sign-in and ignores same-account token refreshes", () => {
  const session = create_home_entrance_session();
  session.observe(null, false);
  session.observe("a", false);
  const key = session.key();
  expect(session.pending("a", session.key())).toBe(true);
  expect(session.claim("b", session.key())).toBe(false);
  expect(session.claim("a", session.key())).toBe(true);
  session.observe("a", false);
  expect(session.key()).toBe(key);
  expect(session.claim("a", session.key())).toBe(false);
});
it("does not arm a saved session on app launch", () => {
  const session = create_home_entrance_session();
  session.observe("a", true);
  expect(session.pending("a", session.key())).toBe(false);
  session.observe("a", false);
  expect(session.claim("a", session.key())).toBe(false);
});
it("re-arms after signing out, including the same UID, and rejects a stale account", () => {
  const session = create_home_entrance_session();
  session.observe("a", false);
  const first = session.key();
  session.claim("a", session.key());
  session.observe(null, false);
  session.observe("a", false);
  expect(session.key()).not.toBe(first);
  expect(session.claim("a", first)).toBe(false);
  expect(session.claim("a", session.key())).toBe(true);
  session.observe("b", false);
  expect(session.pending("a", session.key())).toBe(false);
  expect(session.claim("a", session.key())).toBe(false);
  expect(session.claim("b", session.key())).toBe(true);
});
