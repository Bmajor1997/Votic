import { describe, expect, it } from "vitest";
import { ask_status } from "./askStatus";

describe("Ask status", () => {
  it("matches the requested task and only claims to read supplied content", () => {
    expect(ask_status("Hello")).toBe("Thinking");
    expect(ask_status("What is the main idea?", true)).toBe("Reading");
    expect(ask_status("Summarize this document", true)).toBe("Summarizing");
    expect(ask_status("Compare the two ideas", true)).toBe("Connecting ideas");
    expect(ask_status("Explain it simply", true)).toBe("Putting it simply");
    expect(ask_status("Find a supporting quote", true)).toBe("Finding the passage");
    expect(ask_status("Find information", false)).toBe("Thinking");
  });
});
