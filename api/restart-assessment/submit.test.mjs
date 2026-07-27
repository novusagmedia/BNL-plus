/**
 * Submit endpoint fixtures — handoff appendix D (IDEM, CONSENT, CRM) and §22.2.
 *
 * Runs entirely against an in-memory store and a stub CRM: no network, no
 * database, no credentials. That is the point — §6 Phase 3 says to prove the
 * endpoint before GoHighLevel is wired up.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.RESULT_TOKEN_SECRET =
  process.env.RESULT_TOKEN_SECRET || "test-secret-value-at-least-32-chars-long";
process.env.PUBLIC_SITE_URL = "https://bnlch.com";

const { handleSubmit } = await import("./submit.mjs");
const { createInMemoryRepository } = await import("../_lib/repository.mjs");
const { createStubClient, GhlError } = await import("../_lib/ghl-client.mjs");
const { verifyResultToken } = await import("../_lib/result-token.mjs");

let uuidCounter = 0;
const nextUuid = () =>
  `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`;

function validBody(overrides = {}) {
  const answers = {};
  for (let i = 1; i <= 18; i++) answers[`q${i}`] = 2;

  return {
    clientSubmissionId: nextUuid(),
    contact: {
      firstName: "Elijah",
      email: "Test.Person@Example.COM ",
      phone: "(402) 555-0134",
    },
    segmentation: {
      ageRange: "35-44",
      trainingEnvironment: "Gym",
      mainGoal: "Lose fat and rebuild strength",
      biggestObstacle: "Schedule",
    },
    consent: {
      email: true,
      sms: false,
      consentedAt: new Date().toISOString(),
    },
    answers,
    attribution: {
      sourcePage: "https://bnlch.com/assessment-start.html",
      utmSource: "meta",
      utmCampaign: "rebuild_july",
    },
    ...overrides,
  };
}

function setup({ crm } = {}) {
  const repository = createInMemoryRepository();
  return { repository, crm: crm ?? createStubClient() };
}

const submit = (body, deps) => handleSubmit({ body, ...deps });

/* ============================================================
   Happy path
   ============================================================ */

test("a valid submission is stored, scored, and synced", async () => {
  const deps = setup();
  const { status, body } = await submit(validBody(), deps);

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.submissionId);
  assert.match(body.resultUrl, /^https:\/\/bnlch\.com\/restart-assessment\/result\?token=/);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.scores.restartReadiness, 30);
  assert.equal(stored.results.likelySupportTier, "Coaching");
  assert.equal(stored.results.programDisplay, "Build - Gym Track");
  assert.equal(stored.ghlSyncStatus, "synced");
  assert.ok(stored.workflowEnrolledAt);

  assert.deepEqual(
    deps.crm.calls.map((c) => c.type),
    ["upsertContact", "enrollInWorkflow"],
  );
});

test("the returned token resolves back to the stored submission", async () => {
  const deps = setup();
  const { body } = await submit(validBody(), deps);

  const token = new URL(body.resultUrl).searchParams.get("token");
  const verified = verifyResultToken(token);

  assert.equal(verified.ok, true);
  assert.equal(verified.submissionId, body.submissionId);
});

test("identity values are normalized before storage (§11.2)", async () => {
  const deps = setup();
  const { body } = await submit(validBody(), deps);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.email, "test.person@example.com");
  assert.equal(stored.phone, "+14025550134");
});

test("every stored row carries its version stamps (§24.3)", async () => {
  const deps = setup();
  const { body } = await submit(validBody(), deps);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.assessmentVersion, "restart-assessment-v1");
  assert.equal(stored.scoringVersion, "restart-scoring-v1");
  assert.equal(stored.resultContentVersion, "restart-result-v1");
  assert.equal(stored.resultTokenVersion, "v1");
});

/* ============================================================
   IDEM-001 — idempotency (§13.3)
   ============================================================ */

test("IDEM-001: the same clientSubmissionId creates one row and one enrollment", async () => {
  const deps = setup();
  const body = validBody();

  const first = await submit(body, deps);
  const second = await submit(body, deps);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.submissionId, first.body.submissionId);
  assert.equal(second.body.replayed, true);
  assert.notEqual(first.body.replayed, true);

  // One upsert, one enrollment — the replay did not touch the CRM at all.
  assert.deepEqual(
    deps.crm.calls.map((c) => c.type),
    ["upsertContact", "enrollInWorkflow"],
  );
});

test("a replay does not rescore, even if the browser sends different answers", async () => {
  const deps = setup();
  const body = validBody();
  await submit(body, deps);

  const tampered = structuredClone(body);
  for (let i = 1; i <= 18; i++) tampered.answers[`q${i}`] = 0;
  const { body: replayBody } = await submit(tampered, deps);

  const stored = await deps.repository.findById(replayBody.submissionId);
  assert.equal(stored.scores.restartReadiness, 30, "stored score must not change on replay");
});

test("a replay issues a fresh token so the visitor never gets an expired link", async () => {
  const deps = setup();
  const body = validBody();

  const first = await submit(body, deps);
  const second = await submit(body, deps);

  for (const response of [first, second]) {
    const token = new URL(response.body.resultUrl).searchParams.get("token");
    assert.equal(verifyResultToken(token).ok, true);
  }
});

/* ============================================================
   CONSENT-001 / CONSENT-002 (§18.1)
   ============================================================ */

test("CONSENT-001: missing email consent rejects the submission", async () => {
  const deps = setup();
  const body = validBody();
  body.consent.email = false;

  const { status, body: payload } = await submit(body, deps);

  assert.equal(status, 422);
  assert.equal(payload.code, "VALIDATION_FAILED");
  assert.match(payload.fieldErrors["consent.email"], /consent is required/i);
  assert.equal(deps.crm.calls.length, 0, "nothing may reach the CRM");
});

test("CONSENT-002: declining SMS consent still succeeds", async () => {
  const deps = setup();
  const body = validBody();
  body.consent.sms = false;

  const { status, body: payload } = await submit(body, deps);

  assert.equal(status, 200);
  const stored = await deps.repository.findById(payload.submissionId);
  assert.equal(stored.smsConsent, false);
  assert.equal(stored.emailConsent, true);
});

test("consent is never inferred from a truthy value", async () => {
  const deps = setup();
  const body = validBody();
  body.consent.email = "yes"; // not the boolean true

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

/* ============================================================
   CRM-001 / CRM-002 — the CRM must never block the visitor (§20.1)
   ============================================================ */

test("CRM-001: a GoHighLevel 500 still returns the result and marks retry_required", async () => {
  const crm = createStubClient({
    failWith: new GhlError("boom", { code: "GHL_SERVER_ERROR", status: 500, retryable: true }),
  });
  const deps = setup({ crm });

  const { status, body } = await submit(validBody(), deps);

  assert.equal(status, 200, "the visitor still gets their result");
  assert.ok(body.resultUrl);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.ghlSyncStatus, "retry_required");
  assert.equal(stored.ghlLastErrorCode, "GHL_SERVER_ERROR");
  assert.equal(stored.ghlSyncAttempts, 1);
});

test("CRM-002: a GoHighLevel 401 saves the record and flags permanent failure", async () => {
  const crm = createStubClient({
    failWith: new GhlError("nope", { code: "GHL_UNAUTHORIZED", status: 401, retryable: false }),
  });
  const deps = setup({ crm });

  const logged = [];
  const { status, body } = await handleSubmit({
    body: validBody(),
    ...deps,
    log: (level, details) => logged.push({ level, ...details }),
  });

  assert.equal(status, 200);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.ghlSyncStatus, "permanent_failure");
  assert.equal(stored.ghlLastErrorCode, "GHL_UNAUTHORIZED");

  // §20.3 requires a human alert for auth failures.
  assert.ok(logged.some((entry) => entry.alert === true && entry.level === "error"));
});

test("a draft workflow is treated as a failure, not a silent success", async () => {
  const crm = createStubClient();
  // GoHighLevel answers 201 {"succeeded":true} for draft workflows even though
  // nothing runs. The client must reject that rather than record enrollment.
  crm.enrollInWorkflow = async () => {
    throw new GhlError('workflow is "draft"', {
      code: "GHL_WORKFLOW_NOT_PUBLISHED",
      retryable: false,
    });
  };
  const deps = setup({ crm });

  const logged = [];
  const { body } = await handleSubmit({
    body: validBody(),
    ...deps,
    log: (level, details) => logged.push({ level, ...details }),
  });

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(
    stored.workflowEnrolledAt,
    null,
    "must stay unenrolled so the retry worker picks it up once published",
  );
  assert.equal(stored.ghlSyncStatus, "synced", "the contact itself is fine");
  assert.equal(stored.ghlLastErrorCode, "GHL_WORKFLOW_NOT_PUBLISHED");
  assert.ok(logged.some((e) => e.alert === true), "a human must be alerted");
});

test("a failed workflow enrollment does not undo a successful contact sync", async () => {
  const crm = createStubClient();
  // Upsert succeeds, enrollment does not — the common case before the Day 0
  // workflow exists in GoHighLevel.
  crm.enrollInWorkflow = async () => {
    throw new GhlError("no workflow", { code: "GHL_NOT_CONFIGURED", retryable: false });
  };
  const deps = setup({ crm });

  const { status, body } = await submit(validBody(), deps);
  assert.equal(status, 200);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.ghlSyncStatus, "synced", "the lead did reach the CRM");
  assert.ok(stored.ghlContactId, "the contact id must be retained");
  assert.equal(stored.workflowEnrolledAt, null, "enrollment is still outstanding");
  assert.equal(stored.ghlLastErrorCode, "GHL_NOT_CONFIGURED");
});

test("a rate-limited CRM is treated as retryable", async () => {
  const crm = createStubClient({
    failWith: new GhlError("slow down", { code: "GHL_RATE_LIMITED", status: 429, retryable: true }),
  });
  const deps = setup({ crm });

  const { body } = await submit(validBody(), deps);
  const stored = await deps.repository.findById(body.submissionId);

  assert.equal(stored.ghlSyncStatus, "retry_required");
});

test("an unrecognized CRM throw is retried rather than dropped", async () => {
  const crm = createStubClient({ failWith: new Error("socket hang up") });
  const deps = setup({ crm });

  const { status, body } = await submit(validBody(), deps);

  assert.equal(status, 200);
  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.ghlSyncStatus, "retry_required");
  assert.equal(stored.ghlLastErrorCode, "GHL_UNKNOWN_ERROR");
});

test("CRM logs never contain contact details or tokens (§21.3)", async () => {
  const crm = createStubClient({
    failWith: new GhlError("boom", { code: "GHL_SERVER_ERROR", status: 500, retryable: true }),
  });
  const deps = setup({ crm });

  const logged = [];
  await handleSubmit({
    body: validBody(),
    ...deps,
    log: (level, details) => logged.push(JSON.stringify(details)),
  });

  const combined = logged.join(" ").toLowerCase();
  for (const secret of ["example.com", "4025550134", "elijah", "token"]) {
    assert.ok(!combined.includes(secret), `log must not contain "${secret}"`);
  }
});

/* ============================================================
   §20.2 — a database failure must not claim success
   ============================================================ */

test("a failed write returns 503 and does not report success", async () => {
  const repository = createInMemoryRepository();
  repository.create = async () => {
    throw new Error("connection terminated");
  };
  const deps = { repository, crm: createStubClient() };

  const { status, body } = await submit(validBody(), deps);

  assert.equal(status, 503);
  assert.equal(body.success, false);
  assert.equal(body.code, "SUBMISSION_TEMPORARILY_UNAVAILABLE");
  assert.equal(deps.crm.calls.length, 0);
});

test("a failed idempotency lookup returns 503 rather than duplicating the lead", async () => {
  const repository = createInMemoryRepository();
  repository.findByClientSubmissionId = async () => {
    throw new Error("connection terminated");
  };
  const deps = { repository, crm: createStubClient() };

  const { status } = await submit(validBody(), deps);
  assert.equal(status, 503);
});

/* ============================================================
   §22.2 — payload validation
   ============================================================ */

test("an out-of-range answer is rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.answers.q7 = 4;

  const { status, body: payload } = await submit(body, deps);
  assert.equal(status, 422);
  assert.ok(payload.fieldErrors.answers);
});

test("a missing question is rejected", async () => {
  const deps = setup();
  const body = validBody();
  delete body.answers.q18;

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("unexpected extra answer keys are rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.answers.q19 = 2;

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("an unapproved enum value is rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.segmentation.mainGoal = "Get shredded";

  const { status, body: payload } = await submit(body, deps);
  assert.equal(status, 422);
  assert.ok(payload.fieldErrors["segmentation.mainGoal"]);
});

test("legacy camelCase values from the old form are rejected, not silently accepted", async () => {
  const deps = setup();
  const body = validBody();
  body.segmentation.ageRange = "35to44";

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("an en-dash age range is rejected — the CRM expects a plain hyphen", async () => {
  const deps = setup();
  const body = validBody();
  body.segmentation.ageRange = "35–44";

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("an unparseable phone number is rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.contact.phone = "555";

  const { status, body: payload } = await submit(body, deps);
  assert.equal(status, 422);
  assert.ok(payload.fieldErrors["contact.phone"]);
});

test("an invalid email is rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.contact.email = "not-an-email";

  const { status, body: payload } = await submit(body, deps);
  assert.equal(status, 422);
  assert.ok(payload.fieldErrors["contact.email"]);
});

test("a non-UUID submission id is rejected", async () => {
  const deps = setup();
  const body = validBody({ clientSubmissionId: "12345" });

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("a future-dated consent timestamp is rejected", async () => {
  const deps = setup();
  const body = validBody();
  body.consent.consentedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { status } = await submit(body, deps);
  assert.equal(status, 422);
});

test("an empty or malformed body is rejected without throwing", async () => {
  const deps = setup();

  for (const body of [{}, null, undefined, [], "string"]) {
    const { status } = await submit(body, deps);
    assert.equal(status, 422, `expected 422 for ${JSON.stringify(body)}`);
  }
});

test("multiple field errors are reported together", async () => {
  const deps = setup();
  const body = validBody();
  body.contact.email = "bad";
  body.contact.phone = "1";
  body.consent.email = false;

  const { body: payload } = await submit(body, deps);

  assert.ok(payload.fieldErrors["contact.email"]);
  assert.ok(payload.fieldErrors["contact.phone"]);
  assert.ok(payload.fieldErrors["consent.email"]);
});

/* ============================================================
   ROUTE-001 / ROUTE-002 persisted correctly
   ============================================================ */

test("ROUTE-001: an under-18 submission stores the flag for workflow routing", async () => {
  const deps = setup();
  const body = validBody();
  body.segmentation.ageRange = "Under 18";

  const { body: payload } = await submit(body, deps);
  const stored = await deps.repository.findById(payload.submissionId);

  assert.equal(stored.results.under18, true);
});

test("ROUTE-002: a pain-concern submission stores the caution flag", async () => {
  const deps = setup();
  const body = validBody();
  body.segmentation.biggestObstacle = "Pain or concern";

  const { body: payload } = await submit(body, deps);
  const stored = await deps.repository.findById(payload.submissionId);

  assert.equal(stored.results.painCaution, true);
  assert.equal(stored.results.biggestConstraint, "Energy and Recovery");
});

/* ============================================================
   Attribution (§19.2) — useful data in, private data out
   ============================================================ */

test("attribution is captured but never invents values", async () => {
  const deps = setup();
  const { body } = await submit(validBody(), deps);

  const stored = await deps.repository.findById(body.submissionId);
  assert.equal(stored.attribution.utmSource, "meta");
  assert.equal(stored.attribution.utmCampaign, "rebuild_july");
  assert.equal(stored.attribution.utmMedium, undefined);
});

test("a non-http source page is discarded", async () => {
  const deps = setup();
  const body = validBody();
  body.attribution.sourcePage = "javascript:alert(1)";

  const { body: payload } = await submit(body, deps);
  const stored = await deps.repository.findById(payload.submissionId);

  assert.equal(stored.attribution.sourcePage, undefined);
});
