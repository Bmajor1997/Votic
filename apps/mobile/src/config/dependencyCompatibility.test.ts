import { verify } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";

const project = createRequire(import.meta.url);
const cli = project.resolve("@expo/cli/package.json", {
  paths: [dirname(project.resolve("expo/package.json"))],
});
const read = createRequire(cli);
const schemas = read(join(dirname(cli), "build/src/start/server/devtools/DevToolsPlugin.schema.js"));
const { createMCPDevToolsExtensionSchema } = read(
  join(dirname(cli), "build/src/start/server/mcp/createMCPDevToolsExtensionSchema.js"),
);
const { z } = read("zod") as typeof import("zod");
const { validate } = read("@expo/schema-utils");

it("Expo's installed Zod rejects oversized constrained input before parsing its elements", () => {
  let visited = 0;
  const schema = z
    .array(
      z.string().refine(() => {
        visited += 1;
        return true;
      }),
    )
    .max(2);
  expect(schema.safeParse(Array(100).fill("input")).success).toBe(false);
  expect(visited).toBe(0);
  expect(schema.safeParse(["valid"]).success).toBe(true);
  expect(visited).toBe(1);
});

it("Expo dev-tool schemas keep validating configuration and CLI output", () => {
  const plugin = {
    packageName: "test-plugin",
    packageRoot: "/test/plugin",
    cliExtensions: {
      description: "Test commands",
      entryPoint: "commands.js",
      commands: [
        {
          name: "inspect",
          title: "Inspect",
          environments: ["cli", "mcp"],
          parameters: [
            { name: "limit", type: "number" },
            { name: "confirm", type: "confirm" },
            { name: "label", type: "text" },
          ],
        },
      ],
    },
  };
  expect(() => validate(schemas.PluginSchema, plugin)).not.toThrow();
  expect(() => validate(schemas.PluginSchema, { ...plugin, packageName: "" })).toThrow();
  expect(() =>
    validate(schemas.DevToolsPluginOutputSchema, [{ type: "text", text: "Ready", level: "info" }]),
  ).not.toThrow();
  expect(() =>
    validate(schemas.DevToolsPluginOutputSchema, [{ type: "unknown", text: "Invalid" }]),
  ).toThrow();
  const command = createMCPDevToolsExtensionSchema(plugin, z);
  expect(command.safeParse({ command: "inspect", limit: 3, confirm: true, label: "example" }).success).toBe(
    true,
  );
  expect(command.safeParse({ command: "inspect", limit: "3" }).success).toBe(false);
  expect(command.safeParse({ command: "inspect", extra: true }).success).toBe(false);
  expect(command.safeParse({ command: "not-a-command" }).success).toBe(false);
});

it("Expo's installed code-signing consumer works with patched node-forge and rejects altered data", () => {
  const signing = read("@expo/code-signing-certificates") as typeof import("@expo/code-signing-certificates");
  const keyPair = signing.generateKeyPair();
  const certificate = signing.generateSelfSignedCodeSigningCertificate({
    keyPair,
    validityNotBefore: new Date(Date.now() - 60_000),
    validityNotAfter: new Date(Date.now() + 60_000),
    commonName: "Votic compatibility test",
  });
  expect(() => signing.validateSelfSignedCertificate(certificate, keyPair)).not.toThrow();
  const payload = Buffer.from("Votic test manifest");
  const signature = Buffer.from(
    signing.signBufferRSASHA256AndVerify(keyPair.privateKey, certificate, payload),
    "base64",
  );
  const { publicKeyPEM } = signing.convertKeyPairToPEM(keyPair);
  expect(verify("sha256", payload, publicKeyPEM, signature)).toBe(true);
  expect(verify("sha256", Buffer.from("Altered manifest"), publicKeyPEM, signature)).toBe(false);
});
