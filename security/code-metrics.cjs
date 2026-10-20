// Language-specific screening metrics, not NASA certification or MC/DC.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const ts = require(path.join(root, "apps/mobile/node_modules/typescript"));
const baselinePath = path.join(__dirname, "complexity-baseline.json");
const sourceFiles = () => cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {cwd: root, encoding: "utf8"})
  .trim().split("\n").filter(f => /\.(?:js|cjs|ts|tsx)$/.test(f) && !/(?:\.test\.|^code_checks\/|^browser_checks\/|\/tests\/)/.test(f));
function functionName(node) {
  if (node.name) return node.name.getText();
  if (ts.isVariableDeclaration(node.parent)) return node.parent.name.getText();
  return "callback";
}
function bodyMetrics(node, source) {
  let complexity = 1, statements = 0;
  function visit(child) {
    if (ts.isFunctionLike(child)) return;
    if (ts.isStatement(child) && !ts.isBlock(child)) statements++;
    if ([ts.SyntaxKind.IfStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.ForStatement,
      ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.DoStatement,
      ts.SyntaxKind.CaseClause, ts.SyntaxKind.CatchClause, ts.SyntaxKind.ConditionalExpression].includes(child.kind)) complexity++;
    if (ts.isBinaryExpression(child) && [ts.SyntaxKind.AmpersandAmpersandToken,
      ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(child.operatorToken.kind)) complexity++;
    ts.forEachChild(child, visit);
  }
  ts.forEachChild(node.body, visit);
  return { complexity, statements, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 };
}
function collect(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const results = {};
  function scope(node, prefix) {
    const ordinals = new Map();
    function visit(child) {
      if (ts.isFunctionLike(child) && child.body) {
        const name = functionName(child);
        const ordinal = (ordinals.get(name) || 0) + 1;
        ordinals.set(name, ordinal);
        const key = `${prefix}/${name}#${ordinal}`;
        results[key] = bodyMetrics(child, source);
        scope(child.body, key);
      } else ts.forEachChild(child, visit);
    }
    ts.forEachChild(node, visit);
  }
  scope(source, file);
  return results;
}
const refArg = process.argv.find(arg => arg.startsWith("--write-baseline="));
let files = sourceFiles(), ref;
if (refArg) {
  ref = refArg.split("=")[1];
  files = cp.execFileSync("git", ["ls-tree", "-r", "--name-only", ref], {cwd: root, encoding: "utf8"})
    .trim().split("\n").filter(file => files.includes(file));
}
const metrics = {};
for (const file of files) {
  const text = ref ? cp.execFileSync("git", ["show", `${ref}:${file}`], {cwd: root, encoding: "utf8"}) : fs.readFileSync(path.join(root, file), "utf8");
  Object.assign(metrics, collect(file, text));
}
if (ref) {
  fs.writeFileSync(baselinePath, JSON.stringify({ ref, functions: Object.fromEntries(Object.entries(metrics).filter(([, m]) => m.complexity > 15 || m.statements > 60)) }, null, 2) + "\n");
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const failures = [];
  for (const [key, value] of Object.entries(metrics)) {
    const previous = baseline.functions[key] || {};
    if (value.complexity > Math.max(15, previous.complexity || 0) || value.statements > Math.max(60, previous.statements || 0))
      failures.push({ function: key, ...value });
  }
  const report = { baseline: baseline.ref, functionCount: Object.keys(metrics).length, failures,
    hotspots: Object.entries(metrics).filter(([, m]) => m.complexity > 15 || m.statements > 60)
      .map(([name, m]) => ({function: name, ...m})).sort((a, b) => b.complexity - a.complexity) };
  fs.mkdirSync(path.join(root, "quality-evidence"), {recursive: true});
  fs.writeFileSync(path.join(root, "quality-evidence/code-metrics.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`${report.functionCount} functions measured; ${report.hotspots.length} existing hotspots; ${failures.length} regressions.`);
  if (failures.length) { console.error(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
}
