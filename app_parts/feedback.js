import { createHash, randomUUID } from "node:crypto";

export const FEEDBACK_STATUSES = [
  "New",
  "Under Review",
  "Planned",
  "In Progress",
  "Resolved",
];
export const FEEDBACK_SEVERITIES = [
  "Unassessed",
  "Low",
  "Medium",
  "High",
  "Critical",
];
export class FeedbackError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message) => {
  throw new FeedbackError(400, message);
};
const digest = (text) => createHash("sha256").update(text).digest("hex");
export const normalize_feedback = (text) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, " ")
    .trim();
const fields = {
  title: 120,
  description: 5000,
  steps: 3000,
  expected: 2000,
  actual: 2000,
};
export function validate_feedback(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) => !["category", "requestId", ...Object.keys(fields)].includes(key),
    )
  )
    fail("Invalid feedback fields.");
  if (!["feature", "bug"].includes(body.category))
    fail("Choose a feedback category.");
  if (
    typeof body.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId)
  )
    fail("Invalid submission reference.");
  const result = { category: body.category, requestId: body.requestId };
  for (const [key, max] of Object.entries(fields))
    result[key] = validate_text(body[key], key, max);
  if (!result.title || !result.description)
    fail("A title and description are required.");
  if (
    body.category === "feature" &&
    ["steps", "expected", "actual"].some((key) => result[key])
  )
    fail("Reproduction fields are only for bug reports.");
  return result;
}
function validate_text(input, key, max) {
  const value = input ?? "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    fail(`Invalid ${key}; maximum ${max} characters.`);
  return value.trim();
}
const signature = (body) =>
  digest(
    JSON.stringify([
      body.category,
      ...Object.keys(fields).map((key) =>
        body.category === "bug"
          ? body[key].normalize("NFKC").replace(/\s+/gu, " ").trim()
          : normalize_feedback(body[key]),
      ),
    ]),
  );
const tokens = (text) =>
  new Set(
    normalize_feedback(text)
      .split(" ")
      .filter((word) => word.length > 2),
  );
function similarity(a, b) {
  const left = tokens(a),
    right = tokens(b);
  if (left.size < 3 || right.size < 3) return 0;
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / (left.size + right.size - shared);
}

/** Uses the existing private ledger connection. All mutations and counts share its transaction boundary. */
export function create_feedback_store(
  db,
  { now = () => new Date(), accountDeleted = () => false } = {},
) {
  db.exec(`CREATE TABLE IF NOT EXISTS feedback_groups (
    id TEXT PRIMARY KEY, category TEXT NOT NULL CHECK(category IN ('feature','bug')),
    status TEXT NOT NULL DEFAULT 'New', severity TEXT NOT NULL DEFAULT 'Unassessed',
    safety_flag INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS feedback_submissions (
    id TEXT PRIMARY KEY, request_id TEXT NOT NULL, user_id TEXT NOT NULL, group_id TEXT NOT NULL,
    category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
    steps TEXT NOT NULL, expected TEXT NOT NULL, actual TEXT NOT NULL, fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,request_id),
    FOREIGN KEY(group_id) REFERENCES feedback_groups(id));
    CREATE INDEX IF NOT EXISTS feedback_group_members ON feedback_submissions(group_id,user_id);
    CREATE INDEX IF NOT EXISTS feedback_owner ON feedback_submissions(user_id,created_at);
    CREATE INDEX IF NOT EXISTS feedback_fingerprint ON feedback_submissions(fingerprint);
    CREATE TABLE IF NOT EXISTS feedback_rates (user_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL,
    PRIMARY KEY(user_id,day));`);
  function transaction(work) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function clean_groups() {
    db.exec(
      "DELETE FROM feedback_groups WHERE id NOT IN (SELECT group_id FROM feedback_submissions)",
    );
  }
  function remove_user(uid) {
    // Also remove group display text: titles are always derived from remaining submissions, never copied.
    db.prepare("DELETE FROM feedback_submissions WHERE user_id=?").run(uid);
    db.prepare("DELETE FROM feedback_rates WHERE user_id=?").run(uid);
    clean_groups();
  }
  function prune() {
    db.prepare("DELETE FROM feedback_submissions WHERE created_at<?").run(
      new Date(now().getTime() - 365 * 86400000).toISOString(),
    );
    db.prepare("DELETE FROM feedback_rates WHERE day<?").run(
      now().toISOString().slice(0, 10),
    );
    clean_groups();
  }
  function group(id) {
    const row = db.prepare("SELECT * FROM feedback_groups WHERE id=?").get(id);
    if (!row)
      throw new FeedbackError(
        404,
        "Feedback group not found. Refresh the dashboard.",
      );
    return row;
  }
  function new_group(category, timestamp) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO feedback_groups(id,category,created_at,updated_at) VALUES(?,?,?,?)",
    ).run(id, category, timestamp, timestamp);
    return id;
  }
  function all_groups() {
    return db
      .prepare(
        `SELECT g.*, COUNT(DISTINCT s.user_id) AS unique_users, COUNT(s.id) AS submission_count,
      (SELECT title FROM feedback_submissions t WHERE t.group_id=g.id ORDER BY created_at,id LIMIT 1) AS title
      FROM feedback_groups g JOIN feedback_submissions s ON s.group_id=g.id GROUP BY g.id
      ORDER BY unique_users DESC,g.created_at ASC,g.id ASC`,
      )
      .all();
  }
  function candidates(id) {
    const source = group(id);
    const originals = db
      .prepare(
        "SELECT title,description FROM feedback_submissions WHERE group_id=? ORDER BY created_at,id LIMIT 20",
      )
      .all(id);
    const rows = db
      .prepare(
        `SELECT group_id,title,description FROM feedback_submissions WHERE category=? AND group_id<>?
      ORDER BY created_at DESC,id LIMIT 1000`,
      )
      .all(source.category, id);
    const scores = new Map();
    for (const row of rows) {
      const score = Math.max(
        ...originals.map((item) =>
          similarity(
            item.title + " " + item.description,
            row.title + " " + row.description,
          ),
        ),
      );
      if (score >= 0.55)
        scores.set(
          row.group_id,
          Math.max(scores.get(row.group_id) || 0, score),
        );
    }
    return all_groups()
      .filter((row) => scores.has(row.id))
      .map((row) => ({ ...row, score: scores.get(row.id) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 10);
  }
  function update_group(source, body, timestamp) {
    const status = body.status ?? source.status,
      severity = body.severity ?? source.severity,
      flag = body.safetyFlag ?? Boolean(source.safety_flag);
    if (
      !FEEDBACK_STATUSES.includes(status) ||
      !FEEDBACK_SEVERITIES.includes(severity) ||
      typeof flag !== "boolean" ||
      (source.category !== "bug" && (severity !== "Unassessed" || flag))
    )
      fail("Invalid issue status or severity.");
    db.prepare(
      "UPDATE feedback_groups SET status=?,severity=?,safety_flag=?,updated_at=? WHERE id=?",
    ).run(status, severity, Number(flag), timestamp, body.id);
  }
  function merge_group(source, body, timestamp) {
    if (typeof body.targetId !== "string" || body.targetId === body.id)
      fail("Choose a different target group.");
    const target = group(body.targetId);
    if (source.category !== target.category)
      fail("Features and bugs cannot be merged.");
    db.prepare(
      "UPDATE feedback_submissions SET group_id=?,updated_at=? WHERE group_id=?",
    ).run(target.id, timestamp, source.id);
    const severity =
      FEEDBACK_SEVERITIES[
        Math.max(
          FEEDBACK_SEVERITIES.indexOf(source.severity),
          FEEDBACK_SEVERITIES.indexOf(target.severity),
        )
      ];
    // Keep unresolved safety concerns visible when merging into a previously resolved issue.
    db.prepare(
      "UPDATE feedback_groups SET severity=?,safety_flag=?,status=?,updated_at=? WHERE id=?",
    ).run(
      severity,
      Number(Boolean(source.safety_flag || target.safety_flag)),
      source.status !== "Resolved" && target.status === "Resolved"
        ? "Under Review"
        : target.status,
      timestamp,
      target.id,
    );
    clean_groups();
  }
  function separate_group(source, body, timestamp) {
    const ids = body.submissionIds;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 100 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => typeof id !== "string")
    )
      fail("Select 1 to 100 submissions to separate.");
    const members = db
      .prepare("SELECT id FROM feedback_submissions WHERE group_id=?")
      .all(source.id);
    if (
      ids.length >= members.length ||
      ids.some((id) => !members.some((row) => row.id === id))
    )
      fail("Choose a proper subset of this group's submissions.");
    const target = new_group(source.category, timestamp);
    db.prepare(
      "UPDATE feedback_groups SET severity=?,safety_flag=? WHERE id=?",
    ).run(source.severity, source.safety_flag, target);
    for (const id of ids)
      db.prepare(
        "UPDATE feedback_submissions SET group_id=?,updated_at=? WHERE id=? AND group_id=?",
      ).run(target, timestamp, id, source.id);
    db.prepare("UPDATE feedback_groups SET updated_at=? WHERE id=?").run(
      timestamp,
      source.id,
    );
    return { id: target };
  }
  return {
    prune: () => transaction(prune),
    remove_user,
    create(uid, input) {
      const body = validate_feedback(input),
        fingerprint = signature(body);
      if (typeof uid !== "string" || !uid)
        throw new FeedbackError(401, "Sign in to submit feedback.");
      return transaction(() => {
        if (accountDeleted(uid))
          throw new FeedbackError(403, "This account is being deleted.");
        const prior = db
          .prepare(
            "SELECT id,fingerprint FROM feedback_submissions WHERE user_id=? AND request_id=?",
          )
          .get(uid, body.requestId);
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new FeedbackError(
              409,
              "Submission reference already used. Reopen the form to send new feedback.",
            );
          return { id: prior.id };
        }
        const timestamp = now().toISOString(),
          day = timestamp.slice(0, 10);
        const rate = db
          .prepare("SELECT count FROM feedback_rates WHERE user_id=? AND day=?")
          .get(uid, day);
        if (rate?.count >= 10)
          throw new FeedbackError(
            429,
            "You've reached today's feedback limit. Please try again tomorrow.",
          );
        if (
          db.prepare("SELECT COUNT(*) AS n FROM feedback_submissions").get()
            .n >= 50000
        )
          throw new FeedbackError(
            503,
            "Feedback is temporarily full. Please try again later.",
          );
        // Full normalized payload equality only. Lexical similarities are review suggestions, never automatic merges.
        const matches = db
          .prepare(
            "SELECT DISTINCT group_id FROM feedback_submissions WHERE fingerprint=?",
          )
          .all(fingerprint);
        const group_id =
          matches.length === 1
            ? matches[0].group_id
            : new_group(body.category, timestamp);
        const id = randomUUID();
        db.prepare(
          `INSERT INTO feedback_submissions(id,request_id,user_id,group_id,category,title,description,steps,expected,actual,fingerprint,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          id,
          body.requestId,
          uid,
          group_id,
          body.category,
          body.title,
          body.description,
          body.steps,
          body.expected,
          body.actual,
          fingerprint,
          timestamp,
          timestamp,
        );
        db.prepare("UPDATE feedback_groups SET updated_at=? WHERE id=?").run(
          timestamp,
          group_id,
        );
        db.prepare(
          "INSERT INTO feedback_rates(user_id,day,count) VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1",
        ).run(uid, day);
        return { id };
      });
    },
    dashboard(query = "", page = 0) {
      if (
        typeof query !== "string" ||
        query.length > 200 ||
        !Number.isSafeInteger(page) ||
        page < 0 ||
        page > 1000
      )
        fail("Invalid feedback search.");
      const all = all_groups();
      const needle = query.toLowerCase();
      const matchedIds = needle
        ? new Set(
            db
              .prepare(
                `SELECT DISTINCT group_id FROM feedback_submissions
        WHERE instr(lower(title || ' ' || description || ' ' || steps || ' ' || expected || ' ' || actual),?)>0`,
              )
              .all(needle)
              .map((row) => row.group_id),
          )
        : null;
      const filtered = all.filter(
        (row) => !matchedIds || matchedIds.has(row.id),
      );
      const features = filtered.filter((row) => row.category === "feature");
      const bugs = filtered.filter((row) => row.category === "bug");
      // Safety triage stays above popularity, independently of search and pagination.
      const urgent = all.filter(
        (row) =>
          row.category === "bug" &&
          row.status !== "Resolved" &&
          (row.safety_flag ||
            row.severity === "Critical" ||
            row.severity === "Unassessed"),
      );
      const totals = db
        .prepare(
          "SELECT category,COUNT(*) AS n FROM feedback_submissions GROUP BY category",
        )
        .all();
      return {
        totals: {
          feature: totals.find((row) => row.category === "feature")?.n || 0,
          bug: totals.find((row) => row.category === "bug")?.n || 0,
        },
        features: features.slice(page * 50, (page + 1) * 50),
        bugs: bugs.slice(page * 50, (page + 1) * 50),
        urgent,
        hasMore: Math.max(features.length, bugs.length) > (page + 1) * 50,
        page,
      };
    },
    details(id, page = 0) {
      if (!Number.isSafeInteger(page) || page < 0 || page > 50000)
        fail("Invalid submission page.");
      return {
        group: group(id),
        submissions: db
          .prepare(
            `SELECT s.id,s.title,s.description,s.steps,s.expected,s.actual,s.created_at,s.updated_at,g.status
        FROM feedback_submissions s JOIN feedback_groups g ON g.id=s.group_id WHERE s.group_id=? ORDER BY s.created_at,s.id LIMIT 51 OFFSET ?`,
          )
          .all(id, page * 50),
        candidates: candidates(id),
      };
    },
    mutate(body) {
      if (!body || typeof body !== "object" || Array.isArray(body))
        fail("Invalid administrator operation.");
      const allowed = {
        update: ["action", "id", "status", "severity", "safetyFlag"],
        merge: ["action", "id", "targetId"],
        separate: ["action", "id", "submissionIds"],
      };
      if (
        typeof body.action !== "string" ||
        !Object.hasOwn(allowed, body.action) ||
        Object.keys(body).some((key) => !allowed[body.action].includes(key)) ||
        typeof body.id !== "string"
      )
        fail("Invalid administrator fields.");
      return transaction(() => {
        const source = group(body.id),
          timestamp = now().toISOString();
        if (body.action === "update") update_group(source, body, timestamp);
        else if (body.action === "merge") merge_group(source, body, timestamp);
        else return separate_group(source, body, timestamp);
        return { updated: true };
      });
    },
  };
}
