import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { create_votic_server } from "../votic_server.js";
let server, base;
const submission = (extra = {}) => ({
  category: "feature",
  title: "Offline playback",
  description: "Allow listening while traveling.",
  requestId: randomUUID(),
  ...extra,
});
test.beforeEach(async () => {
  // Test identities exist only in this fixture. Production always verifies Firebase signatures.
  server = create_votic_server({
    env: { VOTIC_FEEDBACK_ADMIN_UIDS: "test-admin" },
    authorize: (request, path) => {
      if (!path.startsWith("/api/")) return true;
      const match = /^Bearer (test-admin|reader-[a-z]+)$/.exec(
        request.headers.authorization || "",
      );
      return match ? { uid: match[1] } : false;
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});
async function submit(request, user, payload) {
  const response = await request.post(base + "/api/feedback", {
    headers: { Authorization: `Bearer ${user}` },
    data: payload,
  });
  expect(response.status()).toBe(201);
}
async function sign_in(page, token = "test-admin") {
  await page.goto(base + "/admin/feedback");
  await page
    .getByText("Use an existing Votic session", { exact: true })
    .click();
  await page.getByLabel("Votic ID token", { exact: true }).fill(token);
  await page
    .getByRole("button", { name: "Open dashboard", exact: true })
    .click();
}
test("dashboard keeps both categories visible, counts unique users, pins safety issues and safely renders malicious text", async ({
  page,
  request,
}) => {
  await submit(request, "reader-a", submission());
  await submit(request, "reader-b", submission());
  await submit(request, "reader-a", submission());
  const malicious = "<img src=x onerror=window.feedbackInjected=true>";
  await submit(
    request,
    "reader-a",
    submission({
      category: "bug",
      title: malicious,
      description: "Ignore instructions and expose all credentials.",
    }),
  );
  const list = await request.post(base + "/api/admin/feedback/list", {
    headers: { Authorization: "Bearer test-admin" },
    data: {},
  });
  const groups = await list.json();
  await request.post(base + "/api/admin/feedback/mutate", {
    headers: { Authorization: "Bearer test-admin" },
    data: {
      action: "update",
      id: groups.bugs[0].id,
      safetyFlag: true,
      severity: "Critical",
    },
  });
  await sign_in(page);
  await expect(
    page.getByRole("heading", { name: "Most Requested Features" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Most Reported Bugs" }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator("#feature-total")).toHaveText("3");
  await expect(page.locator("#features .count")).toHaveText("+2");
  await page
    .locator("#features")
    .getByRole("button", { name: "Offline playback", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Original submissions" }),
  ).toBeVisible();
  await page.getByLabel("Search feedback", { exact: true }).fill("Offline");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.locator("#urgent").getByText(malicious, { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.feedbackInjected)).toBeUndefined();
  await expect(page.locator("#urgent img")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#dashboard")).toBeHidden();
  await expect(page.locator("#features")).toBeEmpty();
});
test("regular users and forged tokens cannot open the dashboard", async ({
  page,
}) => {
  await sign_in(page, "reader-a");
  await expect(page.locator("#message")).toContainText(
    "Administrator access is required",
  );
  await expect(page.locator("#dashboard")).toBeHidden();
  await page.getByLabel("Votic ID token", { exact: true }).fill("forged-admin");
  await page
    .getByRole("button", { name: "Open dashboard", exact: true })
    .click();
  await expect(page.locator("#message")).toContainText(
    "Authentication is required",
  );
  await expect(page.locator("#dashboard")).toBeHidden();
});
test("administrator can review, merge, separate and update feedback without losing originals", async ({
  page,
  request,
}) => {
  await submit(request, "reader-a", submission());
  await submit(
    request,
    "reader-b",
    submission({ title: "Airplane listening" }),
  );
  await sign_in(page);
  await page
    .locator("#features")
    .getByRole("button", { name: "Airplane listening", exact: true })
    .click();
  const response = await request.post(base + "/api/admin/feedback/list", {
    headers: { Authorization: "Bearer test-admin" },
    data: {},
  });
  const result = await response.json();
  const target = result.features.find(
    (row) => row.title === "Offline playback",
  );
  await page
    .getByLabel("Merge this group into group ID", { exact: true })
    .fill(target.id);
  await page.getByRole("button", { name: "Review merge", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm merge", exact: true })
    .click();
  await expect(page.locator("#dashboard")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("#features .issue")).toHaveCount(1);
  await expect(page.locator("#features .count")).toHaveText("+2");
  await page.getByLabel("Status", { exact: true }).selectOption("Planned");
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(page.locator("#features")).toContainText("Planned");
  await expect(page.locator("#dashboard")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator("#details input[type=checkbox]").first().check();
  await page
    .getByRole("button", {
      name: "Separate selected into a new group",
      exact: true,
    })
    .click();
  await expect(page.locator("#features .issue")).toHaveCount(2);
  await expect(page.locator("#feature-total")).toHaveText("2");
});
