// Credentials and tokens stay in memory, never cookies, URLs, localStorage, or logs.
const by_id = (id) => document.getElementById(id);
let token = "",
  config = null,
  currentPage = 0,
  currentGroup = null,
  session = 0,
  expiryTimer;
const message = (text) => {
  by_id("message").textContent = text;
};
const node = (tag, text, cls) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (cls) element.className = cls;
  return element;
};
const button = (text, action) => {
  const element = node("button", text);
  element.type = "button";
  element.addEventListener("click", () => run(action));
  return element;
};
function logout() {
  token = "";
  session++;
  clearTimeout(expiryTimer);
  currentGroup = null;
  by_id("dashboard").hidden = true;
  by_id("signout").hidden = true;
  by_id("login").hidden = false;
  for (const id of ["features", "bugs", "urgent", "details"])
    by_id(id).replaceChildren();
  by_id("password").value = "";
  by_id("token").value = "";
}
async function run(work) {
  try {
    await work();
  } catch (error) {
    message(error.message || "The operation failed. Please try again.");
  }
}
async function api(path, body) {
  const activeSession = session;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  // Optional existing gateway key is a public app identifier, not administrator authorization.
  if (config?.clientKey) headers["X-Votic-Client-Key"] = config.clientKey;
  const response = await fetch(`/api/admin/feedback/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (activeSession !== session)
    throw new Error("The administrator session changed.");
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) logout();
    throw new Error(result.error || "The request failed.");
  }
  return result;
}
async function enter(value, expiresIn = 3600) {
  logout();
  token = value;
  currentPage = 0;
  expiryTimer = setTimeout(
    () => {
      logout();
      message("Your session expired. Sign in again.");
    },
    Math.min(Number(expiresIn) || 3600, 3600) * 1000,
  );
  await refresh();
  by_id("login").hidden = true;
  by_id("dashboard").hidden = false;
  by_id("signout").hidden = false;
  message("Administrator access verified.");
}
function issue(row) {
  const article = node("article", undefined, "issue");
  article.append(node("span", `+${row.unique_users}`, "count"));
  article.append(button(row.title, () => details(row.id)));
  article.append(
    node(
      "p",
      `${row.status} · ${row.submission_count} submissions${row.category === "bug" ? ` · ${row.severity}` : ""}`,
      "meta",
    ),
  );
  return article;
}
async function refresh() {
  const result = await api("list", {
    query: by_id("search").value,
    page: currentPage,
  });
  by_id("feature-total").textContent = result.totals.feature;
  by_id("bug-total").textContent = result.totals.bug;
  for (const key of ["features", "bugs", "urgent"]) {
    by_id(key).replaceChildren(...result[key].map(issue));
    if (!result[key].length)
      by_id(key).append(node("p", "No feedback to show."));
  }
  by_id("previous").disabled = currentPage === 0;
  by_id("next").disabled = !result.hasMore;
  by_id("page").textContent = `Page ${currentPage + 1}`;
}
function select(label, values, current) {
  const wrapper = node("label", label),
    input = node("select");
  for (const value of values) {
    const option = node("option", value);
    option.value = value;
    input.append(option);
  }
  input.value = current;
  wrapper.append(input);
  return { wrapper, input };
}
async function mutate(body) {
  await api("mutate", body);
  await refresh();
  message("Feedback updated.");
}
async function details(id, page = 0) {
  const result = await api("details", { id, page }),
    panel = by_id("details");
  currentGroup = id;
  panel.hidden = false;
  panel.replaceChildren();
  panel.append(
    node("h2", "Feedback group"),
    node(
      "p",
      `Created ${new Date(result.group.created_at).toLocaleString()} · Updated ${new Date(result.group.updated_at).toLocaleString()}`,
    ),
  );
  const status = select(
    "Status",
    ["New", "Under Review", "Planned", "In Progress", "Resolved"],
    result.group.status,
  );
  panel.append(status.wrapper);
  const severity = select(
    "Severity",
    ["Unassessed", "Low", "Medium", "High", "Critical"],
    result.group.severity,
  );
  const safety = node("input");
  safety.type = "checkbox";
  safety.checked = Boolean(result.group.safety_flag);
  const safetyLabel = node(
    "label",
    " Security, privacy, data-loss, or application-blocking issue ",
  );
  safetyLabel.prepend(safety);
  if (result.group.category === "bug")
    panel.append(severity.wrapper, safetyLabel);
  panel.append(
    button("Save status", async () => {
      await mutate({
        action: "update",
        id,
        status: status.input.value,
        severity: severity.input.value,
        safetyFlag: safety.checked,
      });
      await details(id, page);
    }),
  );
  panel.append(node("h3", "Possible matches — review before merging"));
  if (!result.candidates.length)
    panel.append(
      node(
        "p",
        "No close wording matches found. Search for other possible duplicates.",
      ),
    );
  for (const candidate of result.candidates)
    panel.append(
      button(`${candidate.title} · +${candidate.unique_users} · Inspect`, () =>
        details(candidate.id),
      ),
    );
  const mergeForm = node("form"),
    mergeLabel = node("label", "Merge this group into group ID"),
    target = node("input");
  target.required = true;
  target.maxLength = 80;
  mergeLabel.append(target);
  mergeForm.append(mergeLabel);
  panel.append(node("p", `Group ID: ${id}`));
  const reviewMerge = button("Review merge", async () => {
    const targetId = target.value.trim();
    if (!targetId || targetId === id)
      throw new Error("Enter a different group ID.");
    const preview = await api("details", { id: targetId, page: 0 });
    const targetTitle = preview.submissions[0]?.title || targetId;
    const confirmation = node("div");
    confirmation.append(
      node(
        "p",
        `Merge all submissions into “${targetTitle}”? Every original is preserved. The target status is kept unless reopening an unresolved issue.`,
      ),
    );
    confirmation.append(
      button("Confirm merge", async () => {
        await mutate({ action: "merge", id, targetId });
        await details(targetId);
      }),
    );
    mergeForm.append(confirmation);
  });
  mergeForm.addEventListener("submit", (event) => event.preventDefault());
  mergeForm.append(reviewMerge);
  panel.append(mergeForm);
  panel.append(node("h3", "Original submissions"));
  const selected = new Set();
  for (const submission of result.submissions.slice(0, 50)) {
    const article = node("article", undefined, "issue"),
      label = node("label", submission.title),
      checkbox = node("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(submission.id);
      else selected.delete(submission.id);
    });
    label.prepend(checkbox);
    article.append(
      label,
      node("p", new Date(submission.created_at).toLocaleString(), "meta"),
    );
    for (const [key, name] of [
      ["description", "Description"],
      ["steps", "Steps to reproduce"],
      ["expected", "Expected behavior"],
      ["actual", "Actual behavior"],
    ]) {
      if (submission[key])
        article.append(node("h3", name), node("pre", submission[key]));
    }
    panel.append(article);
  }
  panel.append(
    button("Separate selected into a new group", async () => {
      const result = await api("mutate", {
        action: "separate",
        id,
        submissionIds: [...selected],
      });
      await refresh();
      await details(result.id);
      message("Selected submissions separated.");
    }),
  );
  if (page > 0)
    panel.append(button("Previous submissions", () => details(id, page - 1)));
  if (result.submissions.length > 50)
    panel.append(button("More submissions", () => details(id, page + 1)));
  panel.scrollIntoView({ behavior: "instant", block: "start" });
}
by_id("signout").addEventListener("click", () => {
  logout();
  message("Signed out.");
});
by_id("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void run(async () => {
    const activeSession = session;
    const password = by_id("password").value;
    by_id("password").value = "";
    if (!config?.apiKey)
      throw new Error(
        "Administrator sign-in is not configured. Ask the operator to set FIREBASE_WEB_API_KEY.",
      );
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: by_id("email").value,
          password,
          returnSecureToken: true,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.idToken)
      throw new Error(
        "Votic sign-in failed. Check your credentials and try again.",
      );
    if (activeSession !== session) throw new Error("Sign-in was canceled.");
    await enter(result.idToken, result.expiresIn);
  });
});
by_id("token-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = by_id("token").value.trim();
  by_id("token").value = "";
  void run(() => enter(value));
});
by_id("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 0;
  void run(refresh);
});
by_id("refresh").addEventListener("click", () =>
  run(async () => {
    await refresh();
    if (currentGroup) await details(currentGroup);
  }),
);
by_id("previous").addEventListener("click", () => {
  if (currentPage > 0) currentPage--;
  void run(refresh);
});
by_id("next").addEventListener("click", () => {
  currentPage++;
  void run(refresh);
});
window.addEventListener("pagehide", logout);
void run(async () => {
  const response = await fetch("/admin/feedback-config", { cache: "no-store" });
  if (!response.ok)
    throw new Error("Administrator configuration is unavailable.");
  config = await response.json();
});
