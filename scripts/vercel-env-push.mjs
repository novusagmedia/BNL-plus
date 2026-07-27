#!/usr/bin/env node
/**
 * Push environment variables to Vercel.
 *
 * There are 65 of them. Typing those into a dashboard by hand is slow and is
 * exactly where a field ID gets transposed — and a wrong GHL_FIELD_* id fails
 * silently, writing assessment data into the wrong CRM field. This reads the
 * same file the local server uses, so what runs locally is what runs live.
 *
 * Requires `npx vercel login` and `npx vercel link` to have been run first.
 *
 * Usage:
 *   node scripts/vercel-env-push.mjs [envFile] [--target production] [--dry-run]
 *
 * Secrets are read from the file and streamed to the CLI over stdin — never
 * passed as command-line arguments, which would leave them in the process list
 * and shell history.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const targetIndex = args.indexOf("--target");
const TARGET = targetIndex !== -1 ? args[targetIndex + 1] : "production";
const envFile = path.resolve(root, args.find((a) => !a.startsWith("--") && a !== TARGET) || ".env");

if (!fs.existsSync(envFile)) {
  console.error(`Env file not found: ${envFile}`);
  process.exit(1);
}

/**
 * Values that must never be pushed: they are local-only, or they would point
 * production at localhost.
 */
const LOCAL_ONLY = new Set(["PGSSL_NO_VERIFY"]);
const MUST_NOT_BE_LOCALHOST = new Set(["PUBLIC_SITE_URL", "SEVEN_DAY_PLAN_URL"]);

const entries = [];
for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  const [, key, rawValue] = match;
  const value = rawValue.replace(/^["']|["']$/g, "").trim();
  if (!value) continue;
  if (LOCAL_ONLY.has(key)) continue;
  entries.push({ key, value });
}

const localhostLeaks = entries.filter(
  (e) => MUST_NOT_BE_LOCALHOST.has(e.key) && /localhost|127\.0\.0\.1/.test(e.value),
);
if (localhostLeaks.length > 0) {
  console.error("Refusing to push — these would point production at your machine:\n");
  for (const e of localhostLeaks) console.error(`  ${e.key}=${e.value}`);
  console.error("\nFix them in the env file first (use https://www.bnlch.com).");
  process.exit(1);
}

const secretish = /TOKEN|SECRET|PASSWORD|DATABASE_URL/;
const preview = (key, value) =>
  secretish.test(key) ? `${value.slice(0, 6)}…(${value.length} chars)` : value;

console.log(`Source : ${path.relative(root, envFile)}`);
console.log(`Target : ${TARGET}`);
console.log(`Vars   : ${entries.length}\n`);

if (DRY_RUN) {
  for (const { key, value } of entries) console.log(`  ${key} = ${preview(key, value)}`);
  console.log("\nDry run — nothing pushed.");
  process.exit(0);
}

/** Run a vercel command, streaming `input` to stdin. */
function vercel(argv, input) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vercel", ...argv], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

let added = 0;
let failed = 0;

for (const { key, value } of entries) {
  // Remove first so re-running updates rather than erroring on "already exists".
  await vercel(["env", "rm", key, TARGET, "--yes"]);

  const { code, out } = await vercel(["env", "add", key, TARGET], value);
  if (code === 0) {
    added += 1;
    console.log(`  ✓ ${key.padEnd(38)} ${preview(key, value)}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${key.padEnd(38)} ${out.trim().split("\n").pop()}`);
  }
}

console.log(`\nadded/updated: ${added}   failed: ${failed}`);
if (failed > 0) process.exitCode = 1;
else console.log("\nRedeploy for these to take effect: npx vercel --prod");
