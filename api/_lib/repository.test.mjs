/**
 * Repository behaviour — handoff §13.3, §13.4.
 *
 * Covers the in-memory implementation and the factory. The Postgres
 * implementation relies on the unique constraint and the `is null` guard in
 * migrations/001_assessment_submissions.sql, which need a live database to
 * exercise; these tests pin the semantics both implementations must share.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createInMemoryRepository,
  createRepository,
  resetRepository,
} from "./repository.mjs";

function sampleRecord(overrides = {}) {
  return {
    clientSubmissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    scores: { restartReadiness: 30 },
    results: { likelySupportTier: "Coaching" },
    attribution: {},
    assessmentVersion: "restart-assessment-v1",
    scoringVersion: "restart-scoring-v1",
    resultContentVersion: "restart-result-v1",
    resultTokenVersion: "v1",
    ...overrides,
  };
}

/* ============================================================
   Factory — the bug this file exists to prevent
   ============================================================ */

test("createRepository returns one instance per process", () => {
  resetRepository();
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const first = createRepository();
  const second = createRepository();

  // A fresh in-memory store per request would silently break idempotency:
  // the replay lookup would never find the original row.
  assert.equal(first, second);

  resetRepository();
  if (original) process.env.DATABASE_URL = original;
});

test("the in-memory store is refused when production is declared", () => {
  resetRepository();
  assert.throws(
    () => createRepository({ databaseUrl: undefined, allowMemory: false }),
    /DATABASE_URL is required in production/,
  );
  resetRepository();
});

/* ============================================================
   §13.3 — idempotency
   ============================================================ */

test("a duplicate clientSubmissionId returns the original row", async () => {
  const repo = createInMemoryRepository();
  const first = await repo.create(sampleRecord());
  const second = await repo.create(sampleRecord({ firstName: "Someone Else" }));

  assert.equal(second.id, first.id);
  assert.equal(second.firstName, "Elijah", "the original row must win");
});

test("a submission can be found by either key", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  assert.equal((await repo.findById(created.id)).id, created.id);
  assert.equal(
    (await repo.findByClientSubmissionId(created.clientSubmissionId)).id,
    created.id,
  );
});

test("an unknown key resolves to null rather than throwing", async () => {
  const repo = createInMemoryRepository();
  assert.equal(await repo.findById("nope"), null);
  assert.equal(await repo.findByClientSubmissionId("nope"), null);
});

test("stored rows are copies — a caller cannot mutate the store", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  created.firstName = "Tampered";
  const reread = await repo.findById(created.id);

  assert.equal(reread.firstName, "Elijah");
});

/* ============================================================
   §13.4 — sync state
   ============================================================ */

test("a new submission starts pending with no attempts", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  assert.equal(created.ghlSyncStatus, "pending");
  assert.equal(created.ghlSyncAttempts, 0);
  assert.equal(created.ghlContactId, null);
  assert.equal(created.workflowEnrolledAt, null);
});

test("each sync attempt increments the counter and stamps the time", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  const first = await repo.recordGhlSync(created.id, {
    status: "retry_required",
    errorCode: "GHL_SERVER_ERROR",
  });
  assert.equal(first.ghlSyncAttempts, 1);
  assert.equal(first.ghlLastErrorCode, "GHL_SERVER_ERROR");
  assert.ok(first.ghlLastAttemptAt);

  const second = await repo.recordGhlSync(created.id, {
    status: "synced",
    contactId: "ghl-123",
  });
  assert.equal(second.ghlSyncAttempts, 2);
  assert.equal(second.ghlSyncStatus, "synced");
  assert.equal(second.ghlContactId, "ghl-123");
});

test("a later sync without a contact id keeps the one already stored", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  await repo.recordGhlSync(created.id, { status: "synced", contactId: "ghl-123" });
  const after = await repo.recordGhlSync(created.id, {
    status: "retry_required",
    errorCode: "GHL_TIMEOUT",
  });

  assert.equal(after.ghlContactId, "ghl-123");
});

test("an unknown sync status is rejected", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  await assert.rejects(
    () => repo.recordGhlSync(created.id, { status: "kind-of-worked" }),
    RangeError,
  );
});

test("workflow enrollment is recorded exactly once", async () => {
  const repo = createInMemoryRepository();
  const created = await repo.create(sampleRecord());

  const first = await repo.markWorkflowEnrolled(created.id);
  const firstStamp = first.workflowEnrolledAt;
  assert.ok(firstStamp);

  const second = await repo.markWorkflowEnrolled(created.id);
  assert.equal(second.workflowEnrolledAt, firstStamp, "the timestamp must not move");
});
