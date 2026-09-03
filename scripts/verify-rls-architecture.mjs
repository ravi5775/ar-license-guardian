#!/usr/bin/env node
/**
 * Run the external PostgreSQL verification queries and write artifacts/s4-rls.json.
 *
 * Required: SUPABASE_DB_URL (or DATABASE_URL) and psql on PATH.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("SUPABASE_DB_URL or DATABASE_URL is required.");
  process.exit(1);
}

const sql = await readFile(resolve(root, "supabase", "verify-rls.sql"), "utf8");
const output = await new Promise((resolvePromise, reject) => {
  const child = spawn("psql", ["--no-psqlrc", databaseUrl, "-X", "-q", "-t", "-A", "-c", sql], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code !== 0) {
      reject(new Error(stderr.trim() || `psql exited with code ${code}`));
      return;
    }
    resolvePromise(stdout.trim());
  });
});

const report = JSON.parse(output);
report.checked_at = new Date().toISOString();
report.pass =
  report.rls_disabled.length === 0 &&
  report.tables_without_policies.length === 0;

const artifactPath = resolve(root, "artifacts", "s4-rls.json");
await mkdir(dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Wrote ${artifactPath}`);
if (!report.pass) {
  process.exitCode = 1;
}
