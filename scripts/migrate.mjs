#!/usr/bin/env node
/**
 * Apply database migrations — handoff §13.
 *
 * Exists so nobody needs psql installed. Migrations are plain SQL files applied
 * in filename order, and every one of them is written to be safely re-runnable
 * (create-if-not-exists throughout), so running this twice is harmless.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 *   ... --dry-run     list what would be applied
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "migrations");
const DRY_RUN = process.argv.includes("--dry-run");

const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No migrations found.");
  process.exit(0);
}

console.log(`Migrations found: ${files.length}`);
for (const file of files) console.log(`  - ${file}`);

if (DRY_RUN) {
  console.log("\nDry run — nothing applied.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "\nDATABASE_URL is not set.\n" +
      "Create a Postgres database (Neon, Supabase, Vercel Postgres), then:\n" +
      "  DATABASE_URL=postgres://... node scripts/migrate.mjs",
  );
  process.exit(1);
}

const { default: pg } = await import("pg");
// Certificates are verified by default — see sslOptions() in repository.mjs.
const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("sslmode=disable")
    ? false
    : { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== "true" },
});

try {
  await client.connect();
  const { rows } = await client.query("select current_database() as db, version() as version");
  console.log(`\nConnected to "${rows[0].db}"`);
  console.log(`  ${rows[0].version.split(",")[0]}\n`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`  applying ${file} ... `);
    await client.query(sql);
    console.log("ok");
  }

  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  console.log(`\nTables now present: ${tables.map((t) => t.table_name).join(", ") || "(none)"}`);
  console.log("\nDone.");
} catch (error) {
  console.error(`\nFAILED: ${error.message}`);
  if (error.code) console.error(`  code: ${error.code}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
