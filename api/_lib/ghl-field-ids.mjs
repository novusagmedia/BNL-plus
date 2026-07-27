/**
 * GoHighLevel custom field IDs — handoff §8.6.
 *
 * "Do not rely on the human-readable field names as runtime identifiers and do
 * not scatter IDs across multiple files." This is that one file.
 *
 * Values arrive from environment variables once the administrator creates the
 * fields from GO-HIGH-LEVEL/CUSTOM-FIELD-SHEET.md and returns their IDs.
 * Anything still unset is simply omitted from the upsert payload rather than
 * sent as undefined, which GoHighLevel rejects for the whole request.
 */

const ENV_KEYS = {
  // Submission and attribution
  submissionId: "GHL_FIELD_RA_SUBMISSION_ID",
  submittedAt: "GHL_FIELD_RA_SUBMITTED_AT",
  ageRange: "GHL_FIELD_RA_AGE_RANGE",
  trainingEnvironment: "GHL_FIELD_RA_TRAINING_ENVIRONMENT",
  mainGoal: "GHL_FIELD_RA_MAIN_GOAL",
  biggestObstacle: "GHL_FIELD_RA_BIGGEST_OBSTACLE",
  sourcePage: "GHL_FIELD_RA_SOURCE_PAGE",
  referrer: "GHL_FIELD_RA_REFERRER",
  utmSource: "GHL_FIELD_RA_UTM_SOURCE",
  utmMedium: "GHL_FIELD_RA_UTM_MEDIUM",
  utmCampaign: "GHL_FIELD_RA_UTM_CAMPAIGN",
  utmContent: "GHL_FIELD_RA_UTM_CONTENT",
  utmTerm: "GHL_FIELD_RA_UTM_TERM",
  assessmentVersion: "GHL_FIELD_RA_ASSESSMENT_VERSION",
  scoringVersion: "GHL_FIELD_RA_SCORING_VERSION",
  resultContentVersion: "GHL_FIELD_RA_RESULT_CONTENT_VERSION",

  // Category scores — the basis for later segmentation
  trainingConsistencyScore: "GHL_FIELD_RA_TRAINING_CONSISTENCY_SCORE",
  strengthConfidenceScore: "GHL_FIELD_RA_STRENGTH_CONFIDENCE_SCORE",
  nutritionStructureScore: "GHL_FIELD_RA_NUTRITION_STRUCTURE_SCORE",
  energyAndRecoveryScore: "GHL_FIELD_RA_ENERGY_AND_RECOVERY_SCORE",
  scheduleControlScore: "GHL_FIELD_RA_SCHEDULE_CONTROL_SCORE",
  accountabilityRawScore: "GHL_FIELD_RA_ACCOUNTABILITY_RAW_SCORE",
  restartReadinessScore: "GHL_FIELD_RA_RESTART_READINESS_SCORE",
  supportNeedScore: "GHL_FIELD_RA_SUPPORT_NEED_SCORE",

  // Results
  readinessLabel: "GHL_FIELD_RA_READINESS_LABEL",
  trainingLevel: "GHL_FIELD_RA_TRAINING_LEVEL",
  programDisplay: "GHL_FIELD_RA_PROGRAM_DISPLAY",
  biggestConstraint: "GHL_FIELD_RA_BIGGEST_CONSTRAINT",
  likelySupportTier: "GHL_FIELD_RA_LIKELY_SUPPORT_TIER",
  tierMonthlyPrice: "GHL_FIELD_RA_TIER_MONTHLY_PRICE",
  tierTotalPrice: "GHL_FIELD_RA_TIER_TOTAL_PRICE",
  tierPriceDisplay: "GHL_FIELD_RA_TIER_PRICE_DISPLAY",

  // Safety routing — the Day 0 workflow branches on these (§15.2), so an
  // unmapped flag here means an under-18 gets a paid-program CTA.
  under18Flag: "GHL_FIELD_RA_UNDER_18_FLAG",
  painCautionFlag: "GHL_FIELD_RA_PAIN_CAUTION_FLAG",

  // Consent evidence
  emailConsent: "GHL_FIELD_RA_EMAIL_CONSENT",
  smsConsent: "GHL_FIELD_RA_SMS_CONSENT",
  consentTimestamp: "GHL_FIELD_RA_CONSENT_TIMESTAMP",

  // Links
  resultPageUrl: "GHL_FIELD_RA_RESULT_PAGE_URL",
  sevenDayPlanUrl: "GHL_FIELD_RA_SEVEN_DAY_PLAN_URL",

  // NOTE: "RA Last Result Email Submission ID" and "RA Last Result Email Sent
  // At" are written by the GoHighLevel workflow, not by us (§15.2), so they are
  // deliberately absent here.
};

/** Read fresh each call so tests and warm containers pick up config changes. */
export function ghlFieldIds(env = process.env) {
  const ids = {};

  for (const [key, envKey] of Object.entries(ENV_KEYS)) {
    const value = env[envKey];
    if (value) ids[key] = value;
  }

  // Q01-Q18 follow a predictable variable name, so they are read by pattern.
  for (let n = 1; n <= 18; n++) {
    const padded = String(n).padStart(2, "0");
    const value = env[`GHL_FIELD_RA_Q${padded}`];
    if (value) ids[`q${padded}`] = value;
  }

  return ids;
}

/** Which mappings are still missing — surfaced by the config health check. */
export function missingFieldIds(env = process.env) {
  const configured = ghlFieldIds(env);
  return Object.keys(ENV_KEYS).filter((key) => !configured[key]);
}
