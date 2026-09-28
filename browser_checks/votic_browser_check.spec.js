import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test("opens with a focused empty state and personalization", async ({ page }) => {
  await expect(page).toHaveTitle(/Votic/);
  await expect(page.getByRole("heading", { name: "Turn a document into a listening experience." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sections" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Play" })).toBeHidden();
  await expect(page.getByText("Supports PDF, Word (.docx), PowerPoint (.ppt and .pptx), EPUB, TXT, and Markdown files", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Personalize color" }).click();
  await page.getByRole("radio", { name: "Blue" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-highlight-theme", "blue");
  await page.getByRole("button", { name: "Done" }).click();
  await page.locator("#emptyAddDocument").click();
  await expect(page.getByRole("heading", { name: "Add a document" })).toBeVisible();
});

test("answers product questions in the Ask Votic side panel", async ({ page }) => {
  await page.getByRole("button", { name: "Ask Votic" }).click();
  await expect(page.getByRole("heading", { name: "Ask Votic" })).toBeVisible();
  await page.getByPlaceholder("Ask Votic…").fill("How do I change the reading speed?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/speed button on the left side/i)).toBeVisible();
  await page.getByRole("button", { name: "Close Ask Votic" }).click();
  await expect(page.locator("#assistantPanel")).toHaveAttribute("aria-hidden", "true");
});

test("Ask Votic becomes document-aware when a document is open", async ({ page }) => {
  await page.getByRole("button", { name: "Add document" }).click();
  await page.locator("#documentFile").setInputFiles({ name: "context.md", mimeType: "text/markdown", buffer: Buffer.from("# Context\n\n## Main idea\nVotic should use this document as context.") });
  await page.getByRole("button", { name: "Open in reader" }).click();
  await page.getByRole("button", { name: "Ask Votic" }).click();
  await expect(page.getByLabel("Use the current document as context")).toBeChecked();
  await expect(page.getByRole("button", { name: "Summarize this document" })).toBeVisible();
  await expect(page.getByRole("button", { name: "What are the key takeaways?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Explain the section I am reading" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quiz me on this document" })).toBeVisible();
});

test("navigates between Home Documents and Settings", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Listen, learn, and pick up where you left off." })).toBeVisible();
  await page.getByRole("button", { name: /Documents/ }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await page.getByRole("button", { name: /Settings/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: /Home/ }).click();
  await expect(page.getByRole("heading", { name: "Listen, learn, and pick up where you left off." })).toBeVisible();
});

test("saved documents appear in the Documents library and reopen", async ({ page }) => {
  await page.getByRole("button", { name: "Add document" }).first().click();
  await page.getByLabel("Remember this document on this device").check();
  await page.locator("#documentFile").setInputFiles({ name: "library.md", mimeType: "text/markdown", buffer: Buffer.from("# Library document\n\n## Notes\nThis document should be saved.") });
  await page.getByRole("button", { name: "Open in reader" }).click();
  await page.getByRole("button", { name: /Documents/ }).click();
  await expect(page.getByRole("heading", { name: "library" })).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator("#documentTitle")).toHaveText("library");
  await page.getByRole("button", { name: "Ask Votic" }).click();
  await expect(page.getByLabel("Use the current document as context")).toBeChecked();
});

test("uploads a heading-based reading document", async ({ page }) => {
  await page.getByRole("button", { name: "Add document" }).click();
  await page.locator("#documentFile").setInputFiles({ name: "field-notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Field Notes\n\n## Start\nFirst passage.\n\n## Findings\nSecond passage.") });
  await page.getByRole("button", { name: "Open in reader" }).click();
  await expect(page.getByRole("heading", { name: "Field Notes" })).toBeVisible();
  await page.getByRole("button", { name: "Accessibility options" }).click();
  await page.getByRole("radio", { name: "Large", exact: true }).check();
  await page.getByLabel("Extra spacing").check();
  await page.getByLabel("Reduce animation and movement").check();
  await page.getByLabel("Enlarge the current word").uncheck();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  await expect(page.locator("html")).toHaveAttribute("data-reading-spacing", "extra");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-word-emphasis", "off");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Sections" }).click();
  await expect(page.locator("#sectionList").getByText("Findings")).toBeVisible();
  await page.getByRole("button", { name: "Close sections" }).click();
  await page.getByRole("button", { name: "Close document", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Return to the upload screen?" })).toBeVisible();
  await page.getByRole("button", { name: "Close document", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Turn a document into a listening experience." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeHidden();
});

test("stores document content only after explicit consent and can clear it", async ({ page }) => {
  await page.getByRole("button", { name: "Add document" }).click();
  await expect(page.getByLabel(/Remember this document/)).not.toBeChecked();
  await page.locator("#documentFile").setInputFiles({ name: "private.md", mimeType: "text/markdown", buffer: Buffer.from("# Private\n\nSession only.") });
  await page.getByRole("button", { name: "Open in reader" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("votic.resume.v1"))).toBeNull();
  await page.getByRole("button", { name: "Close document", exact: true }).click();
  await page.getByRole("button", { name: "Close document", exact: true }).last().click();

  await page.getByRole("button", { name: "Add document" }).click();
  await page.getByLabel(/Remember this document/).check();
  await page.locator("#documentFile").setInputFiles({ name: "saved.md", mimeType: "text/markdown", buffer: Buffer.from("# Saved\n\nKeep this.") });
  await page.getByRole("button", { name: "Open in reader" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("votic.resume.v1"))).not.toBeNull();
  await page.getByRole("button", { name: "Close document", exact: true }).click();
  await page.getByRole("button", { name: "Clear saved data" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("votic.resume.v1"))).toBeNull();
});

