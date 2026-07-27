/**
 * GoHighLevel API v2 client — handoff §14, §20.3.
 *
 * Server-only. The token never reaches the browser, and errors are classified
 * into "retry this" vs "a human must fix this" so the retry worker never spins
 * forever on a bad token or an unmapped field.
 *
 * Runs in one of two modes (GHL_MODE):
 *   stub — no network. Records what would have been sent. This is the default
 *          until the Private Integration has the right scopes, so the rest of
 *          the pipeline can be built and tested end to end.
 *   live — real API calls.
 */

import { ghlFieldIds } from "./ghl-field-ids.mjs";

/** Thrown for every CRM failure; `retryable` drives §20.3 handling. */
export class GhlError extends Error {
  constructor(message, { code, status = null, retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.name = "GhlError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * §20.3 — 429 and 5xx are transient; 400/401/403/422 mean the payload, token,
 * scopes, or field mapping are wrong and retrying cannot help.
 */
function classify(status, retryAfterHeader) {
  if (status === 429) {
    const seconds = Number(retryAfterHeader);
    return {
      code: "GHL_RATE_LIMITED",
      retryable: true,
      retryAfterMs: Number.isFinite(seconds) ? seconds * 1000 : null,
    };
  }
  if (status >= 500) return { code: "GHL_SERVER_ERROR", retryable: true };
  if (status === 401) return { code: "GHL_UNAUTHORIZED", retryable: false };
  if (status === 403) return { code: "GHL_FORBIDDEN", retryable: false };
  if (status === 422) return { code: "GHL_UNPROCESSABLE", retryable: false };
  if (status === 400) return { code: "GHL_BAD_REQUEST", retryable: false };
  return { code: "GHL_UNEXPECTED_STATUS", retryable: false };
}

/**
 * Build the customFields array (§14.3).
 *
 * Only fields with a configured ID are included: a half-configured mapping
 * should send less data, never send a field with an undefined id — GoHighLevel
 * rejects the whole upsert for one bad entry.
 */
export function buildCustomFields(submission, fieldIds = ghlFieldIds()) {
  const scores = submission.scores ?? {};
  const results = submission.results ?? {};
  const attribution = submission.attribution ?? {};

  const values = {
    submissionId: submission.id,
    submittedAt: submission.createdAt ?? new Date().toISOString(),
    ageRange: submission.ageRange,
    trainingEnvironment: submission.trainingEnvironment,
    mainGoal: submission.mainGoal,
    biggestObstacle: submission.biggestObstacle,

    sourcePage: attribution.sourcePage,
    referrer: attribution.referrer,
    utmSource: attribution.utmSource,
    utmMedium: attribution.utmMedium,
    utmCampaign: attribution.utmCampaign,
    utmContent: attribution.utmContent,
    utmTerm: attribution.utmTerm,

    assessmentVersion: submission.assessmentVersion,
    scoringVersion: submission.scoringVersion,
    resultContentVersion: submission.resultContentVersion,

    trainingConsistencyScore: scores.trainingConsistency,
    strengthConfidenceScore: scores.strengthConfidence,
    nutritionStructureScore: scores.nutritionStructure,
    energyAndRecoveryScore: scores.energyAndRecovery,
    scheduleControlScore: scores.scheduleControl,
    accountabilityRawScore: scores.accountabilityRaw,
    restartReadinessScore: scores.restartReadiness,
    supportNeedScore: scores.supportNeed,

    readinessLabel: results.readinessLabel,
    trainingLevel: results.trainingLevel,
    programDisplay: results.programDisplay,
    biggestConstraint: results.biggestConstraint,
    likelySupportTier: results.likelySupportTier,
    tierMonthlyPrice: results.monthlyPrice,
    tierTotalPrice: results.totalPrice,
    tierPriceDisplay: results.priceDisplay,

    // Booleans become explicit Yes/No so the workflow can branch on a dropdown
    // rather than on an empty-vs-present check.
    under18Flag: results.under18 ? "Yes" : "No",
    painCautionFlag: results.painCaution ? "Yes" : "No",

    emailConsent: submission.emailConsent ? "Yes" : "No",
    smsConsent: submission.smsConsent ? "Yes" : "No",
    consentTimestamp: submission.consentedAt,

    resultPageUrl: submission.resultUrl,
    sevenDayPlanUrl: process.env.SEVEN_DAY_PLAN_URL,
  };

  const fields = [];
  for (const [key, value] of Object.entries(values)) {
    const id = fieldIds[key];
    if (!id) continue;
    if (value === undefined || value === null || value === "") continue;
    fields.push({ id, field_value: value });
  }

  // Q01-Q18 land in their own fields when configured.
  (submission.answers ?? []).forEach((answer, index) => {
    const id = fieldIds[`q${String(index + 1).padStart(2, "0")}`];
    if (id) fields.push({ id, field_value: answer });
  });

  return fields;
}

/* ============================================================
   Live client
   ============================================================ */

function createLiveClient(config) {
  const {
    baseUrl = process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com",
    token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
    locationId = process.env.GHL_LOCATION_ID,
    apiVersion = process.env.GHL_API_VERSION || "2021-07-28",
    workflowId = process.env.GHL_RESULT_WORKFLOW_ID,
    timeoutMs = Number(process.env.GHL_TIMEOUT_MS) || 10_000,
    fieldIds = ghlFieldIds(),
  } = config;

  if (!token) throw new GhlError("GHL token is not configured.", { code: "GHL_NOT_CONFIGURED" });
  if (!locationId) {
    throw new GhlError("GHL location id is not configured.", { code: "GHL_NOT_CONFIGURED" });
  }

  /**
   * Look up a workflow's publish status, cached briefly.
   *
   * Cached because this runs on the visitor's request path: publishing state
   * changes rarely, but a lookup per submission would add a round trip to
   * every lead. A short TTL means flipping the workflow to published takes
   * effect within a minute without a redeploy.
   *
   * Returns null when the status cannot be determined (missing scope, network
   * blip) — an unknown status must not block a real enrollment.
   */
  let workflowStatusCache = { at: 0, byId: new Map() };
  const WORKFLOW_CACHE_MS = 60_000;

  async function workflowStatus(targetWorkflowId) {
    const fresh = Date.now() - workflowStatusCache.at < WORKFLOW_CACHE_MS;
    if (fresh && workflowStatusCache.byId.has(targetWorkflowId)) {
      return workflowStatusCache.byId.get(targetWorkflowId);
    }

    try {
      const data = await request(`/workflows/?locationId=${encodeURIComponent(locationId)}`, {
        method: "GET",
      });
      const byId = new Map((data?.workflows ?? []).map((w) => [w.id, w.status]));
      workflowStatusCache = { at: Date.now(), byId };
      return byId.get(targetWorkflowId) ?? null;
    } catch {
      return null;
    }
  }

  async function request(path, { method = "POST", body } = {}) {
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          Version: apiVersion,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Timeouts and DNS/socket failures are always worth retrying (§20.3).
      throw new GhlError(`GoHighLevel request failed: ${error.name}`, {
        code: error.name === "TimeoutError" ? "GHL_TIMEOUT" : "GHL_NETWORK_ERROR",
        retryable: true,
      });
    }

    if (!response.ok) {
      const { code, retryable, retryAfterMs } = classify(
        response.status,
        response.headers.get("retry-after"),
      );
      // Only the status and a sanitized code are surfaced — §21.3 forbids
      // logging full CRM response bodies, which can echo contact data.
      throw new GhlError(`GoHighLevel responded ${response.status}`, {
        code,
        status: response.status,
        retryable,
        retryAfterMs,
      });
    }

    return response.status === 204 ? {} : response.json().catch(() => ({}));
  }

  return {
    mode: "live",

    /** §14.2 — follows the sub-account's duplicate rules (email first, phone second). */
    async upsertContact(submission) {
      const payload = {
        locationId,
        firstName: submission.firstName,
        email: submission.email,
        phone: submission.phone,
        source: "BNL Plus Restart Assessment",
        customFields: buildCustomFields(submission, fieldIds),
      };

      const data = await request("/contacts/upsert", { body: payload });
      const contactId = data?.contact?.id ?? data?.id ?? null;

      // §14.4 — a 200 without an id is an integration fault, not a success.
      if (!contactId) {
        throw new GhlError("GoHighLevel upsert returned no contact id.", {
          code: "GHL_MISSING_CONTACT_ID",
          retryable: false,
        });
      }

      return { contactId };
    },

    /** §14.5 — caller guarantees consent is true and enrollment has not happened. */
    async enrollInWorkflow(contactId, targetWorkflowId = workflowId) {
      if (!targetWorkflowId) {
        throw new GhlError("GHL workflow id is not configured.", {
          code: "GHL_NOT_CONFIGURED",
          retryable: false,
        });
      }

      // GoHighLevel returns 201 {"succeeded": true} when enrolling into a
      // DRAFT workflow, but a draft performs no actions — the contact is
      // silently dropped and never receives the Day 0 email. Verified against
      // the live API on 2026-07-27. Without this check the submission would be
      // marked enrolled and the retry worker would never revisit it, so the
      // failure would be invisible until someone noticed nobody got an email.
      const status = await workflowStatus(targetWorkflowId);
      if (status && status !== "published") {
        throw new GhlError(
          `Workflow ${targetWorkflowId} is "${status}", not published — enrollment would silently do nothing.`,
          { code: "GHL_WORKFLOW_NOT_PUBLISHED", retryable: false },
        );
      }

      await request(`/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(targetWorkflowId)}`);
      return { enrolled: true };
    },
  };
}

/* ============================================================
   Stub client
   ============================================================ */

/**
 * Records calls instead of making them. `failWith` lets tests reproduce the
 * CRM-001 / CRM-002 fixtures without touching the network.
 */
export function createStubClient({ failWith = null, fieldIds = ghlFieldIds() } = {}) {
  const calls = [];

  return {
    mode: "stub",
    calls,

    async upsertContact(submission) {
      calls.push({
        type: "upsertContact",
        email: submission.email,
        customFieldCount: buildCustomFields(submission, fieldIds).length,
      });
      if (failWith) throw failWith;
      return { contactId: `stub-contact-${submission.id}` };
    },

    async enrollInWorkflow(contactId) {
      calls.push({ type: "enrollInWorkflow", contactId });
      if (failWith) throw failWith;
      return { enrolled: true };
    },
  };
}

export function createGhlClient(config = {}) {
  const mode = config.mode ?? process.env.GHL_MODE ?? "stub";
  return mode === "live" ? createLiveClient(config) : createStubClient(config);
}
