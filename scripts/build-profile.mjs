#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const profile = process.argv[2];
if (!["admin", "client", "selfhost"].includes(profile)) {
  console.error("Usage: node scripts/build-profile.mjs <admin|client|selfhost>");
  process.exit(2);
}

const result = spawnSync("vite", ["build", "--mode", "production"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, VITE_BUILD_PROFILE: profile },
});

if (result.error) {
  console.error(`Unable to start Vite: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
