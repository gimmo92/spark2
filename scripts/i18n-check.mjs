// Checks the UI translations: every tr("…") key has an English entry, and dictionaries don't disagree.
// Usage: npm run i18n:check   (exit code 1 when something is missing)
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const files = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, f)).filter((f) => /\.tsx?$/.test(f) && !f.includes("node_modules"))
    : [];

/** Keys used as tr("literal") in a source tree. */
function usedKeys(dir) {
  const out = new Map();
  for (const f of files(dir)) {
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText() === "tr" && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]))
        out.set(n.arguments[0].text, path.relative(ROOT, f));
      ts.forEachChild(n, visit);
    };
    visit(read(f));
  }
  return out;
}

/** Entries of `export const EN = { … }` in a dictionary file. */
function dict(file) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isStringLiteralLike(n.initializer)) {
      const k = ts.isIdentifier(n.name) ? n.name.text : ts.isStringLiteralLike(n.name) ? n.name.text : null;
      if (k != null) out.set(k, n.initializer.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(read(file));
  return out;
}

const core = dict(path.join(ROOT, "packages/core/src/i18n/en.ts"));
// feature modules: each has its own dictionary, merged over the core one
const modules = ["mbo", "transparency"].map((m) => ({ name: `@spark/${m}`, dir: `packages/${m}/src`, dict: dict(path.join(ROOT, `packages/${m}/src/i18n/en.ts`)) }));
const scopes = [
  { name: "@spark/core", dir: "packages/core/src", dicts: [core] },
  ...modules.map((m) => ({ name: m.name, dir: m.dir, dicts: [core, m.dict] })),
  ...fs.readdirSync(path.join(ROOT, "apps")).map((a) => ({
    name: `apps/${a}`,
    dir: `apps/${a}/src`,
    dicts: [core, ...modules.map((m) => m.dict), dict(path.join(ROOT, `apps/${a}/src/i18n/en.ts`))],
  })),
];

let problems = 0;
for (const s of scopes) {
  const missing = [...usedKeys(path.join(ROOT, s.dir))].filter(([k]) => !s.dicts.some((d) => d.has(k)));
  for (const [k, f] of missing) console.log(`missing  ${s.name}  ${JSON.stringify(k)}  (${f})`);
  problems += missing.length;
}
// the module dictionary is merged over the core one: a different translation would change core screens
for (const m of modules)
  for (const [k, v] of m.dict) if (core.has(k) && core.get(k) !== v) {
    console.log(`conflict ${JSON.stringify(k)}: core ${JSON.stringify(core.get(k))} / ${m.name} ${JSON.stringify(v)}`);
    problems++;
  }
console.log(problems ? `${problems} problem(s)` : "i18n ok");
process.exit(problems ? 1 : 0);
