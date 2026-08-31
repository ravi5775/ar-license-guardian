#!/usr/bin/env node
/**
 * Minimal jq polyfill for environments without jq installed.
 *
 * Supports only the subset the audit scripts use:
 *   jq -r '.field'            jq -r '.a.b'
 *   jq -r '.arr | length'     jq -r '.field // "default"'
 *   jq -s '.'                 (slurp stdin JSON documents into an array)
 * Anything else exits 3 so a stage reports NOT_VERIFIED rather than a wrong PASS.
 */
const args = process.argv.slice(2);
const raw = args.includes("-r") || args.includes("--raw-output");
const slurp = args.includes("-s") || args.includes("--slurp");
const filter = args.find((a) => !a.startsWith("-")) ?? ".";

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const text = chunks.join("");
  let doc;
  try {
    doc = slurp
      ? text
          .split(/\n(?=\{)/)
          .filter((s) => s.trim())
          .map((s) => JSON.parse(s))
      : JSON.parse(text);
  } catch {
    process.exit(3);
  }
  let value;
  try {
    value = evaluate(doc, filter.trim());
  } catch {
    process.exit(3);
  }
  const out = raw && typeof value === "string" ? value : JSON.stringify(value ?? null);
  process.stdout.write(out + "\n");
});

function evaluate(doc, expr) {
  const [head, ...pipes] = expr.split("|").map((s) => s.trim());
  let value = path(doc, head.split("//")[0].trim());
  const fallback = head.includes("//") ? head.split("//")[1].trim() : undefined;
  if ((value === undefined || value === null) && fallback !== undefined) {
    value = JSON.parse(fallback.replace(/'/g, '"'));
  }
  for (const p of pipes) {
    if (p === "length") value = Array.isArray(value) ? value.length : Object.keys(value ?? {}).length;
    else value = path(value, p);
  }
  return value;
}

function path(doc, expr) {
  if (expr === "." || expr === "") return doc;
  let value = doc;
  for (const key of expr.replace(/^\./, "").split(".")) {
    if (value == null) return undefined;
    value = value[key.replace(/^"|"$/g, "")];
  }
  return value;
}
