/**
 * Submission validation and normalization — handoff §11.2, §11.3.
 *
 * §11.3 specifies Zod. This is a hand-rolled equivalent with the same
 * semantics, chosen so the serverless functions stay dependency-light; the
 * shapes and messages below mirror the documented schema field for field.
 * Swapping in Zod later is a contained change — only this file knows the rules.
 *
 * Error messages are visitor-facing: they are rendered next to the field on
 * the contact gate, so they say what to do rather than what went wrong.
 */

import {
  AGE_RANGES,
  BIGGEST_OBSTACLES,
  MAIN_GOALS,
  TRAINING_ENVIRONMENTS,
} from "./constants.mjs";
import {
  isValidEmail,
  normalizeAttributionValue,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  normalizeUrl,
} from "./normalization.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ATTRIBUTION_KEYS = [
  "referrer",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
];

/**
 * @returns {{ok: true, value: object} | {ok: false, fieldErrors: Record<string,string>}}
 */
export function validateSubmission(input) {
  const errors = {};
  const body = isPlainObject(input) ? input : {};

  /* ---- idempotency key (§9.1) ---- */
  const clientSubmissionId = typeof body.clientSubmissionId === "string"
    ? body.clientSubmissionId.trim()
    : "";
  if (!UUID_RE.test(clientSubmissionId)) {
    errors.clientSubmissionId = "This submission could not be identified. Please try again.";
  }

  /* ---- contact ---- */
  const contact = isPlainObject(body.contact) ? body.contact : {};

  const firstName = normalizeText(contact.firstName, { maxLength: 80 });
  if (!firstName) errors["contact.firstName"] = "Enter your first name.";

  const email = normalizeEmail(contact.email);
  if (!isValidEmail(email)) errors["contact.email"] = "Enter a valid email address.";

  const phone = normalizePhone(contact.phone);
  if (!phone) errors["contact.phone"] = "Enter a valid phone number.";

  /* ---- segmentation ---- */
  const segmentation = isPlainObject(body.segmentation) ? body.segmentation : {};

  const ageRange = pickEnum(segmentation.ageRange, AGE_RANGES);
  if (!ageRange) errors["segmentation.ageRange"] = "Select your age range.";

  const trainingEnvironment = pickEnum(segmentation.trainingEnvironment, TRAINING_ENVIRONMENTS);
  if (!trainingEnvironment) {
    errors["segmentation.trainingEnvironment"] = "Select a training environment.";
  }

  const mainGoal = pickEnum(segmentation.mainGoal, MAIN_GOALS);
  if (!mainGoal) errors["segmentation.mainGoal"] = "Select your main goal.";

  const biggestObstacle = pickEnum(segmentation.biggestObstacle, BIGGEST_OBSTACLES);
  if (!biggestObstacle) errors["segmentation.biggestObstacle"] = "Select your biggest obstacle.";

  /* ---- consent (§18.1) — never inferred, never defaulted ---- */
  const consent = isPlainObject(body.consent) ? body.consent : {};

  if (consent.email !== true) {
    errors["consent.email"] = "Email consent is required to deliver your result.";
  }
  if (typeof consent.sms !== "boolean") {
    errors["consent.sms"] = "SMS consent must be answered.";
  }

  const consentedAt = parseIsoTimestamp(consent.consentedAt);
  if (!consentedAt) errors["consent.consentedAt"] = "Consent timestamp is missing or invalid.";

  /* ---- answers (§11.2) — exactly Q1-Q18, integers 0-3, no extras ---- */
  const { answers, error: answersError } = parseAnswers(body.answers);
  if (answersError) errors.answers = answersError;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    value: {
      clientSubmissionId: clientSubmissionId.toLowerCase(),
      firstName,
      email,
      phone,
      ageRange,
      trainingEnvironment,
      mainGoal,
      biggestObstacle,
      emailConsent: true,
      smsConsent: consent.sms,
      consentedAt,
      answers,
      attribution: parseAttribution(body.attribution),
    },
  };
}

function parseAnswers(raw) {
  if (!isPlainObject(raw)) {
    return { error: "Answer all 18 questions before submitting." };
  }

  const keys = Object.keys(raw);
  const expected = Array.from({ length: 18 }, (_, i) => `q${i + 1}`);

  const unexpected = keys.filter((key) => !expected.includes(key));
  if (unexpected.length > 0) {
    return { error: "The submitted answers were not recognized. Please retake the assessment." };
  }

  const answers = [];
  for (const key of expected) {
    const value = raw[key];
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      return { error: "Answer all 18 questions before submitting." };
    }
    answers.push(value);
  }

  return { answers };
}

function parseAttribution(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const attribution = {};

  const sourcePage = normalizeUrl(source.sourcePage);
  if (sourcePage) attribution.sourcePage = sourcePage;

  for (const key of ATTRIBUTION_KEYS) {
    const value = normalizeAttributionValue(source[key]);
    if (value) attribution[key] = value;
  }

  return attribution;
}

/**
 * Accept an ISO timestamp from the browser, but never trust it blindly: a
 * clock-skewed or forged consent time is rejected so the stored consent record
 * stays defensible. The server also records its own received time.
 */
function parseIsoTimestamp(value, { now = Date.now(), toleranceMs = 24 * 60 * 60 * 1000 } = {}) {
  if (typeof value !== "string") return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const skew = parsed.getTime() - now;
  if (skew > 5 * 60 * 1000) return null; // meaningfully in the future
  if (skew < -toleranceMs) return null; // implausibly stale

  return parsed.toISOString();
}

function pickEnum(value, allowed) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : null;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
