import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { fileURLToPath } from "node:url";

export const USERJOT_MCP_URL = "https://api.userjot.com/v1/mcp";

/** Discover the actual API contract before mapping requests. Never read feedback or call write tools here. */
export async function inspectUserJot({ token, makeClient = () => new Client({ name: "votic-feedback-bridge", version: "1.0.0" }), makeTransport = (url, options) => new StreamableHTTPClientTransport(url, options) }) {
  if (typeof token !== "string" || !token.trim()) throw new Error("USERJOT_API_TOKEN is required.");
  const client = makeClient();
  const transport = makeTransport(new URL(USERJOT_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token.trim()}` }, redirect: "error" },
    fetch: (url, init) => {
      // Tokens go only to the documented endpoint, never to redirects or discovered hosts.
      if (new URL(String(url)).href !== USERJOT_MCP_URL) throw new Error("Unexpected UserJot endpoint.");
      return fetch(url, { ...init, redirect: "error" });
    },
  });
  const tools = [];
  const seen = new Set();
  let cursor;
  try {
    await client.connect(transport, { timeout: 15_000 });
    for (let page = 0; page < 10; page += 1) {
      const result = await client.listTools(cursor ? { cursor } : {}, { timeout: 15_000 });
      tools.push(...result.tools);
      if (!result.nextCursor) return {
        connected: true,
        // Log schema only: no customer feedback, account data, token, or provider error text.
        requestTools: tools.filter((tool) => /list.*requests|get.*request/i.test(tool.name))
          .map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })),
      };
      if (seen.has(result.nextCursor)) throw new Error("UserJot repeated a pagination cursor.");
      seen.add(result.nextCursor);
      cursor = result.nextCursor;
    }
    throw new Error("UserJot tool discovery exceeded the page limit.");
  } finally {
    await client.close().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.USERJOT_API_TOKEN) {
    console.log("UserJot connection is not configured. Add the USERJOT_API_TOKEN repository secret, then rerun this check.");
  } else {
    try { console.log(JSON.stringify(await inspectUserJot({ token: process.env.USERJOT_API_TOKEN }), null, 2)); }
    catch { console.error("UserJot connection check failed. Verify API access and the USERJOT_API_TOKEN repository secret."); process.exitCode = 1; }
  }
}
