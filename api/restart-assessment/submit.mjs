/**
 * POST /api/restart-assessment/submit — handoff §11, §B.
 *
 * The one place a Restart Assessment becomes real. Processing order follows
 * §11.1 exactly, and the ordering matters:
 *
 *   the visitor's result is guaranteed by the DATABASE write,
 *   not by the CRM call.
 *
 * So a GoHighLevel outage returns a perfectly good result URL and leaves a
 * retryable record behind (§20.1), while a database failure returns 503 and
 * asks the visitor to try again rather than showing a result we did not store
 * (§20.2).
 */

import {
  ASSESSMENT_VERSION,
  RESULT_CONTENT_VERSION,
  SCORING_VERSION,
} from "../_lib/constants.mjs";
import { createGhlClient, GhlError } from "../_lib/ghl-client.mjs";
import { createRepository } from "../_lib/repository.mjs";
import { buildResultUrl, createResultToken, TOKEN_VERSION } from "../_lib/result-token.mjs";
import { calculateAssessment } from "../_lib/scoring.mjs";
import { validateSubmission } from "../_lib/validation.mjs";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * Testable core. Dependencies are injected so the whole flow can be exercised
 * against an in-memory store and a stub CRM with no network and no database.
 *
 * @returns {{status: number, body: object}}
 */
export async function handleSubmit({ body, repository, crm, log = () => {} }) {
  /* 1-3. Validate and normalize (§11.2) */
  const validated = validateSubmission(body);
  if (!validated.ok) {
    return {
      status: 422,
      body: {
        success: false,
        code: "VALIDATION_FAILED",
        fieldErrors: validated.fieldErrors,
      },
    };
  }

  const input = validated.value;

  /* 4-5. Idempotency (§13.3) — a replay returns the stored result and must not
     re-score, re-insert, or re-enroll. A fresh token is issued so a returning
     visitor is not handed an expired link. */
  let existing;
  try {
    existing = await repository.findByClientSubmissionId(input.clientSubmissionId);
  } catch (error) {
    log("error", { at: "findByClientSubmissionId", code: error.code });
    return temporarilyUnavailable();
  }

  if (existing) {
    return {
      status: 200,
      body: {
        success: true,
        submissionId: existing.id,
        resultUrl: buildResultUrl(createResultToken(existing.id)),
        replayed: true,
      },
    };
  }

  /* 6. Authoritative scoring — never trusts anything the browser computed. */
  const { scores, results } = calculateAssessment(input.answers, {
    biggestObstacle: input.biggestObstacle,
    trainingEnvironment: input.trainingEnvironment,
    ageRange: input.ageRange,
  });

  /* 7. Store before doing anything external. */
  let submission;
  try {
    submission = await repository.create({
      ...input,
      scores,
      results,
      assessmentVersion: ASSESSMENT_VERSION,
      scoringVersion: SCORING_VERSION,
      resultContentVersion: RESULT_CONTENT_VERSION,
      resultTokenVersion: TOKEN_VERSION,
    });
  } catch (error) {
    log("error", { at: "create", code: error.code });
    return temporarilyUnavailable();
  }

  /* 8. Signed result URL (§16). */
  const resultUrl = buildResultUrl(createResultToken(submission.id));

  /* 9-10. CRM sync. Deliberately last, deliberately non-fatal. */
  await syncToGhl({ submission: { ...submission, resultUrl }, repository, crm, log });

  /* 11. The visitor gets their result either way. */
  return {
    status: 200,
    body: { success: true, submissionId: submission.id, resultUrl },
  };
}

/**
 * Upsert the contact and enroll it in the Day 0 workflow.
 *
 * Never throws: every failure is recorded on the submission row so the retry
 * worker can pick it up from stored data (§20.1). The visitor's response does
 * not depend on any of this succeeding.
 */
async function syncToGhl({ submission, repository, crm, log }) {
  let contactId;

  try {
    ({ contactId } = await crm.upsertContact(submission));
    await repository.recordGhlSync(submission.id, { status: "synced", contactId });
  } catch (error) {
    const { code, retryable } = describeCrmError(error);
    await repository
      .recordGhlSync(submission.id, {
        status: retryable ? "retry_required" : "permanent_failure",
        errorCode: code,
      })
      .catch(() => {});

    // 401/403 mean a human has to fix the token, scopes, or location (§20.3).
    log(retryable ? "warn" : "error", {
      at: "upsertContact",
      submissionId: submission.id,
      code,
      retryable,
      alert: !retryable,
    });
    return;
  }

  /* §14.5 / §15.2 — enroll only with email consent, and only once. */
  if (!submission.emailConsent || submission.workflowEnrolledAt) return;

  try {
    await crm.enrollInWorkflow(contactId);
    await repository.markWorkflowEnrolled(submission.id);
  } catch (error) {
    const { code, retryable } = describeCrmError(error);

    // The contact itself is safely in the CRM, so ghl_sync_status stays
    // "synced" — §13.4 defines that as "contact upsert and required field
    // mapping succeeded", which is exactly what happened. Enrollment is
    // tracked separately by workflow_enrolled_at, which stays null here; the
    // retry worker finds this row via
    //   ghl_contact_id is not null and workflow_enrolled_at is null
    // Downgrading the status instead would lose the fact that the lead reached
    // GoHighLevel at all.
    await repository
      .recordGhlSync(submission.id, { status: "synced", contactId, errorCode: code })
      .catch(() => {});

    log(retryable ? "warn" : "error", {
      at: "enrollInWorkflow",
      submissionId: submission.id,
      code,
      retryable,
      alert: !retryable,
    });
  }
}

function describeCrmError(error) {
  if (error instanceof GhlError) {
    return { code: error.code, retryable: error.retryable };
  }
  // An unrecognized throw is treated as transient: a lead is worth a retry.
  return { code: "GHL_UNKNOWN_ERROR", retryable: true };
}

function temporarilyUnavailable() {
  return {
    status: 503,
    body: {
      success: false,
      code: "SUBMISSION_TEMPORARILY_UNAVAILABLE",
      message: "We could not securely save your result. Please try again.",
    },
  };
}

/* ============================================================
   Vercel handler
   ============================================================ */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    const tooLarge = error.code === "BODY_TOO_LARGE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      code: tooLarge ? "BODY_TOO_LARGE" : "INVALID_JSON",
    });
  }

  const repository = createRepository();
  const crm = createGhlClient();

  try {
    const { status, body: payload } = await handleSubmit({
      body,
      repository,
      crm,
      log: (level, details) => {
        // §21.3: submission id, status, and sanitized codes only — never
        // contact details, answers, consent payloads, or tokens.
        console[level === "error" ? "error" : "warn"](
          JSON.stringify({ scope: "restart-assessment.submit", ...details }),
        );
      },
    });
    return res.status(status).json(payload);
  } catch (error) {
    console.error(
      JSON.stringify({ scope: "restart-assessment.submit", at: "unhandled", code: error.code }),
    );
    return res.status(503).json({
      success: false,
      code: "SUBMISSION_TEMPORARILY_UNAVAILABLE",
      message: "We could not securely save your result. Please try again.",
    });
  }
}

/** Vercel may pre-parse the body; fall back to reading the stream ourselves. */
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") return req.body;
    if (typeof req.body === "string") return JSON.parse(req.body);
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
