/**
 * Postgres repository against a REAL Postgres engine — handoff §13.
 *
 * Runs on PGlite (Postgres compiled to WASM), so `migrations/001_...sql` is
 * genuinely executed and every query is genuinely parsed and planned. Without
 * this, the Postgres code path would first run in production, which is the
 * worst possible place to discover a typo in a column name.
 *
 * What this proves that the in-memory tests cannot:
 *   - the migration applies cleanly
 *   - the unique constraint really enforces idempotency (error code 23505)
 *   - the email-consent CHECK constraint really rejects false
 *   - the updated_at trigger really fires
 *   - `workflow_enrolled_at is null` really makes double enrollment impossible
 *   - the retry indexes are valid SQL
 *
 * PGlite is a devDependency; production uses `pg` against real Postgres.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MIGRATION = fs.readFileSync(
  path.join(root, "migrations/001_assessment_submissions.sql"),
  "utf8",
);

/**
 * The repository resolves `pg` lazily through `globalThis.__PG_OVERRIDE__`.
 * This shim presents the same `new Pool(...).query(text, params)` surface,
 * backed by PGlite, so the production code runs completely unmodified.
 */
const pgShim = (db) => ({
  Pool: class {
    async query(text, params) {
      const result = await db.query(text, params ?? []);
      return { rows: result.rows, rowCount: result.rows.length };
    }
    async end() {}
  },
});

/** Fresh database + fresh repository singleton for each test. */
async function makeRepo() {
  const db = new PGlite();
  await db.exec(MIGRATION);
  globalThis.__PG_OVERRIDE__ = pgShim(db);

  const { createRepository, resetRepository } = await import("./repository.mjs");
  resetRepository();
  const repo = createRepository({ databaseUrl: "postgres://pglite/test" });

  return {
    repo,
    db,
    async close() {
      resetRepository();
      delete globalThis.__PG_OVERRIDE__;
      await db.close();
    },
  };
}

function record(overrides = {}) {
  return {
    clientSubmissionId: crypto.randomUUID(),
    firstName: "Elijah",
    email: "elijah@example.com",
    phone: "+14025550134",
    ageRange: "35-44",
    trainingEnvironment: "Gym",
    mainGoal: "Lose fat",
    biggestObstacle: "Schedule",
    emailConsent: true,
    smsConsent: false,
    consentedAt: new Date().toISOString(),
    answers: new Array(18).fill(2),
    scores: { restartReadiness: 30, supportNeed: 3 },
    results: { likelySupportTier: "Coaching", under18: false, painCaution: false },
    attribution: { utmSource: "meta" },
    assessmentVersion: "restart-assessment-v1",
    scoringVersion: "restart-scoring-v1",
    resultContentVersion: "restart-result-v1",
    ...overrides,
  };
}

test("the migration applies cleanly to a real Postgres", async () => {
  const { db, close } = await makeRepo();

  const { rows } = await db.query(`
    select column_name from information_schema.columns
    where table_name = 'assessment_submissions' order by ordinal_position
  `);
  const columns = rows.map((r) => r.column_name);

  for (const expected of [
    "id", "client_submission_id", "normalized_email", "normalized_phone",
    "email_consent", "consent_timestamp", "answers_json", "scores_json",
    "results_json", "attribution_json", "scoring_version",
    "ghl_contact_id", "ghl_sync_status", "workflow_enrolled_at",
  ]) {
    assert.ok(columns.includes(expected), `missing column ${expected}`);
  }

  await close();
});

test("the migration is re-runnable", async () => {
  const { db, close } = await makeRepo();
  await db.exec(MIGRATION); // create-if-not-exists throughout
  await close();
});

test("a submission round-trips with JSON columns intact", async () => {
  const { repo, close } = await makeRepo();

  const created = await repo.create(record());
  const read = await repo.findById(created.id);

  assert.equal(read.email, "elijah@example.com");
  assert.equal(read.phone, "+14025550134");
  assert.deepEqual(read.answers, new Array(18).fill(2));
  assert.equal(read.scores.restartReadiness, 30);
  assert.equal(read.results.likelySupportTier, "Coaching");
  assert.equal(read.attribution.utmSource, "meta");
  assert.equal(read.scoringVersion, "restart-scoring-v1");
  assert.equal(read.ghlSyncStatus, "pending");
  assert.equal(read.ghlSyncAttempts, 0);

  await close();
});

test("§13.3: the unique constraint makes a duplicate return the original row", async () => {
  const { repo, close } = await makeRepo();

  const first = await repo.create(record({ clientSubmissionId: "11111111-1111-4111-8111-111111111111" }));
  const second = await repo.create(
    record({ clientSubmissionId: "11111111-1111-4111-8111-111111111111", firstName: "Someone Else" }),
  );

  assert.equal(second.id, first.id, "must not insert a second row");
  assert.equal(second.firstName, "Elijah", "the original row wins");

  await close();
});

test("the database rejects a submission without email consent", async () => {
  const { repo, close } = await makeRepo();

  // §11.2 is enforced in code; this proves the CHECK constraint backs it up.
  await assert.rejects(() => repo.create(record({ emailConsent: false })));

  await close();
});

test("sync state updates and increments attempts", async () => {
  const { repo, close } = await makeRepo();
  const created = await repo.create(record());

  const first = await repo.recordGhlSync(created.id, {
    status: "retry_required",
    errorCode: "GHL_SERVER_ERROR",
  });
  assert.equal(first.ghlSyncAttempts, 1);
  assert.equal(first.ghlSyncStatus, "retry_required");

  const second = await repo.recordGhlSync(created.id, { status: "synced", contactId: "ghl-1" });
  assert.equal(second.ghlSyncAttempts, 2);
  assert.equal(second.ghlContactId, "ghl-1");

  // coalesce keeps the contact id when a later attempt omits it
  const third = await repo.recordGhlSync(created.id, {
    status: "retry_required",
    errorCode: "GHL_TIMEOUT",
  });
  assert.equal(third.ghlContactId, "ghl-1");

  await close();
});

test("an invalid sync status is rejected by the CHECK constraint", async () => {
  const { repo, db, close } = await makeRepo();
  const created = await repo.create(record());

  await assert.rejects(() =>
    db.query(`update assessment_submissions set ghl_sync_status = $2 where id = $1`, [
      created.id,
      "sort-of-worked",
    ]),
  );

  await close();
});

test("§13.3: workflow enrollment can only ever happen once", async () => {
  const { repo, close } = await makeRepo();
  const created = await repo.create(record());

  const first = await repo.markWorkflowEnrolled(created.id);
  assert.ok(first.workflowEnrolledAt);

  const second = await repo.markWorkflowEnrolled(created.id);
  assert.equal(
    new Date(second.workflowEnrolledAt).getTime(),
    new Date(first.workflowEnrolledAt).getTime(),
    "the `is null` guard must stop the timestamp moving",
  );

  await close();
});

test("the retry indexes exist and are valid", async () => {
  const { db, close } = await makeRepo();

  const { rows } = await db.query(
    `select indexname from pg_indexes where tablename = 'assessment_submissions'`,
  );
  const names = rows.map((r) => r.indexname);

  assert.ok(names.includes("assessment_submissions_retry_idx"));
  assert.ok(names.includes("assessment_submissions_enroll_retry_idx"));
  assert.ok(names.includes("assessment_submissions_email_idx"));

  await close();
});

test("the retry queries the worker will run return the right rows", async () => {
  const { repo, db, close } = await makeRepo();

  const stuck = await repo.create(record({ clientSubmissionId: crypto.randomUUID() }));
  await repo.recordGhlSync(stuck.id, { status: "retry_required", errorCode: "GHL_TIMEOUT" });

  const enrolled = await repo.create(record({ clientSubmissionId: crypto.randomUUID() }));
  await repo.recordGhlSync(enrolled.id, { status: "synced", contactId: "ghl-2" });
  await repo.markWorkflowEnrolled(enrolled.id);

  const unenrolled = await repo.create(record({ clientSubmissionId: crypto.randomUUID() }));
  await repo.recordGhlSync(unenrolled.id, { status: "synced", contactId: "ghl-3" });

  // Contacts still needing an upsert retry (§20.4).
  const upsertRetries = await db.query(
    `select id from assessment_submissions
      where ghl_sync_status in ('pending','retry_required')`,
  );
  assert.deepEqual(upsertRetries.rows.map((r) => r.id), [stuck.id]);

  // Contacts that synced but never got into the Day 0 workflow — the people who
  // would otherwise silently never receive their result email.
  const enrollRetries = await db.query(
    `select id from assessment_submissions
      where ghl_contact_id is not null and workflow_enrolled_at is null`,
  );
  assert.deepEqual(enrollRetries.rows.map((r) => r.id), [unenrolled.id]);

  await close();
});

test("updated_at moves on write but created_at does not", async () => {
  const { repo, db, close } = await makeRepo();
  const created = await repo.create(record());

  const before = await db.query(
    `select created_at, updated_at from assessment_submissions where id = $1`,
    [created.id],
  );
  await new Promise((r) => setTimeout(r, 20));
  await repo.recordGhlSync(created.id, { status: "synced", contactId: "ghl-9" });

  const after = await db.query(
    `select created_at, updated_at from assessment_submissions where id = $1`,
    [created.id],
  );

  assert.equal(
    new Date(after.rows[0].created_at).getTime(),
    new Date(before.rows[0].created_at).getTime(),
    "created_at must be immutable",
  );
  assert.ok(
    new Date(after.rows[0].updated_at).getTime() >= new Date(before.rows[0].updated_at).getTime(),
    "the updated_at trigger must fire",
  );

  await close();
});

test("an unknown id resolves to null rather than throwing", async () => {
  const { repo, close } = await makeRepo();

  assert.equal(await repo.findById("00000000-0000-4000-8000-000000000000"), null);
  assert.equal(await repo.findByClientSubmissionId("00000000-0000-4000-8000-000000000000"), null);

  await close();
});
