#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const artifactDir = path.join(root, "artifacts");
const runId = process.env.AUDIT_RUN_ID ?? `v22-${Date.now()}`;
const tools = ["gitleaks", "osv-scanner", "k6", "autocannon", "psql", "node", "bun", "git"];

async function toolVersion(tool) {
  try {
    const result = await run(tool, ["--version"], { maxBuffer: 1024 * 1024 });
    return `${result.stdout}${result.stderr}`.trim().split(/\r?\n/, 1)[0];
  } catch {
    return null;
  }
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function phase({ id, name, tool, artifact }) {
  const result = {
    phase: id,
    name,
    tool,
    artifact,
    status: "NOT_VERIFIED",
    reason: null,
    measuredValues: null,
  };
  if (!(await toolVersion(tool))) {
    result.reason = `${tool} not on PATH; cannot produce real measurements`;
    return result;
  }

  let raw = "";
  let exitCode = 0;
  try {
    const output = await run(tool, ["--version"], { maxBuffer: 1024 * 1024 });
    raw = `${output.stdout}${output.stderr}`;
  } catch (error) {
    raw = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    exitCode = typeof error.code === "number" ? error.code : 1;
  }
  await writeFile(path.join(artifactDir, `${id}.raw.txt`), raw, "utf8");
  if (exitCode !== 0) {
    result.status = "FAIL";
    result.reason = `${tool} exited ${exitCode}`;
    return result;
  }
  if (!(await exists(path.join(root, artifact)))) {
    result.reason = `${tool} produced no artifact at ${artifact}`;
    return result;
  }
  result.measuredValues = JSON.parse(
    await import("node:fs/promises").then(({ readFile }) =>
      readFile(path.join(root, artifact), "utf8"),
    ),
  );
  result.status = "PASS";
  return result;
}

const phases = tools.map((tool, index) => ({
  id: `S${String(index + 1).padStart(2, "0")}`,
  name: `${tool} evidence check`,
  tool,
  artifact: `artifacts/${tool}.json`,
}));

await mkdir(artifactDir, { recursive: true });
const tooling = {};
for (const tool of tools) tooling[tool] = await toolVersion(tool);
await writeFile(
  path.join(artifactDir, "00-tooling.json"),
  `${JSON.stringify({ runId, tooling }, null, 2)}\n`,
  "utf8",
);

const results = [];
for (const phaseDefinition of phases) results.push(await phase(phaseDefinition));
const notVerified = results.filter((result) => result.status === "NOT_VERIFIED").length;
const failed = results.filter((result) => result.status === "FAIL").length;
const weighted = results.length
  ? Math.round((results.filter((result) => result.status === "PASS").length / results.length) * 100)
  : 0;
const score = notVerified > 0 ? Math.min(weighted, 90) : weighted;
const verdict =
  failed > 0 ? "FAIL" : notVerified > 0 ? "CONDITIONAL_PASS" : score >= 95 ? "PASS" : "CONDITIONAL_PASS";
const report = {
  runId,
  generatedAt: new Date().toISOString(),
  phases: results,
  overall: { score, verdict, notVerifiedCount: notVerified, failedCount: failed },
};

await writeFile(
  path.join(root, "docs", "enterprise-qa-metrics.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(`${verdict} score=${score} notVerified=${notVerified} failed=${failed}`);
process.exitCode = failed > 0 ? 1 : 0;
