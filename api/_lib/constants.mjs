/**
 * Locked vocabularies for the Body Rebuild Restart Assessment.
 *
 * Source of truth: BNL_Plus_Restart_Assessment_GoHighLevel_Implementation_Handoff_v1
 * (sections 3, 8, 11.2, 12, appendix A).
 *
 * Nothing in this file may change without Elijah Robles' approval — the values
 * here are simultaneously the API contract, the GoHighLevel dropdown options,
 * and the scoring inputs. A rename here silently breaks CRM segmentation.
 */

export const ASSESSMENT_VERSION = process.env.ASSESSMENT_VERSION || "restart-assessment-v1";
export const SCORING_VERSION = process.env.SCORING_VERSION || "restart-scoring-v1";
export const RESULT_CONTENT_VERSION = process.env.RESULT_CONTENT_VERSION || "restart-result-v1";

/* ============================================================
   Canonical enum values (handoff §11.2, §8.2)
   These are the exact strings sent over the wire and stored in
   GoHighLevel dropdowns. Note the plain hyphen in age ranges —
   the website *displays* an en-dash, which must not leak here.
   ============================================================ */

export const AGE_RANGES = ["Under 18", "18-34", "35-44", "45-54", "55-64", "65+"];

export const TRAINING_ENVIRONMENTS = ["Home", "Gym", "Both", "Not sure"];

/* Handoff §26 open item 1 — resolved from the live contact gate. */
export const MAIN_GOALS = [
  "Lose fat",
  "Rebuild strength",
  "Lose fat and rebuild strength",
  "More energy and consistency",
];

export const BIGGEST_OBSTACLES = [
  "Schedule",
  "Unsure what to do",
  "Nutrition",
  "Energy or recovery",
  "Accountability",
  "Pain or concern",
  "Other",
];

export const CATEGORIES = [
  "Training Consistency",
  "Strength Confidence",
  "Nutrition Structure",
  "Energy and Recovery",
  "Schedule Control",
  "Accountability",
];

export const READINESS_LABELS = ["Restarting", "Rebuilding", "Ready to Progress"];
export const TRAINING_LEVELS = ["Foundation", "Build", "Performance"];
export const SUPPORT_TIERS = ["Essentials", "Coaching", "Private"];

/* ============================================================
   Bridge from the live website's <select> values to canonical.

   The contact gate currently uses camelCase option values
   (`loseFat`, `35to44`, `notSure`). Phase 5 replaces those with the
   canonical strings directly so one vocabulary exists end to end.
   Until then the browser maps through these tables at submit time.
   ============================================================ */

export const LEGACY_VALUE_MAP = {
  ageRange: {
    under18: "Under 18",
    "18to34": "18-34",
    "35to44": "35-44",
    "45to54": "45-54",
    "55to64": "55-64",
    "65plus": "65+",
  },
  trainingEnvironment: {
    home: "Home",
    gym: "Gym",
    both: "Both",
    notSure: "Not sure",
  },
  mainGoal: {
    loseFat: "Lose fat",
    rebuildStrength: "Rebuild strength",
    both: "Lose fat and rebuild strength",
    energyConsistency: "More energy and consistency",
  },
  biggestObstacle: {
    schedule: "Schedule",
    unsureWhatToDo: "Unsure what to do",
    nutrition: "Nutrition",
    energyRecovery: "Energy or recovery",
    accountability: "Accountability",
    painConcern: "Pain or concern",
    other: "Other",
  },
};

/* ============================================================
   Pricing (handoff §3 — locked, all tiers are 16 weeks)
   ============================================================ */

export const TIER_PRICING = {
  Essentials: { monthlyPrice: 149, totalPrice: 596, priceDisplay: "$149 x 4" },
  Coaching: { monthlyPrice: 229, totalPrice: 916, priceDisplay: "$229 x 4" },
  Private: { monthlyPrice: 499, totalPrice: 1996, priceDisplay: "$499 x 4" },
};

/* ============================================================
   Scoring structure (handoff §12.2, §12.6)
   ============================================================ */

/** Question indices (0-based) contributing to each category. */
export const CATEGORY_QUESTIONS = {
  "Training Consistency": [0, 1, 2],
  "Strength Confidence": [3, 4, 5],
  "Nutrition Structure": [6, 7, 8],
  "Energy and Recovery": [9, 10, 11],
  "Schedule Control": [12, 13, 14],
  Accountability: [15, 16, 17],
};

/**
 * Restart Readiness sums Q1–Q15 only. Accountability (Q16–Q18) is
 * deliberately excluded — it drives Support Need instead, so that
 * training level and support tier stay independent decisions (§3).
 */
export const READINESS_QUESTION_COUNT = 15;

/** Applied when the lowest category score is tied (§12.6). */
export const CONSTRAINT_FALLBACK_ORDER = [
  "Schedule Control",
  "Training Consistency",
  "Nutrition Structure",
  "Energy and Recovery",
  "Strength Confidence",
  "Accountability",
];

export const OBSTACLE_TO_CATEGORY = {
  Schedule: "Schedule Control",
  "Unsure what to do": "Strength Confidence",
  Nutrition: "Nutrition Structure",
  "Energy or recovery": "Energy and Recovery",
  Accountability: "Accountability",
  "Pain or concern": "Energy and Recovery",
  // "Other" intentionally absent — falls through to CONSTRAINT_FALLBACK_ORDER.
};

/* ============================================================
   Appendix A — the exact 18 statements, in order.
   Reproduced here so the server can verify the browser is running
   the same assessment version it is scoring against.
   ============================================================ */

export const QUESTIONS = [
  "I currently complete at least three intentional workouts per week.",
  "I have maintained a consistent exercise routine during the last three months.",
  "When I miss a workout, I return to my plan instead of abandoning the week.",
  "I know which strength exercises are appropriate for my current experience.",
  "I understand how to choose a safe starting weight.",
  "I know how to progress an exercise without sacrificing technique.",
  "I have a repeatable meal structure during busy weeks.",
  "I consistently include enough protein in my meals.",
  "My weekends and restaurant meals do not regularly erase my weekday progress.",
  "I usually have enough energy to complete my planned workouts.",
  "My sleep and recovery allow me to train consistently.",
  "My soreness or stiffness does not repeatedly prevent me from exercising.",
  "I know exactly when my three weekly workouts will happen.",
  "I have a backup plan when work or family disrupts my schedule.",
  "I can consistently protect 30-60 minutes for training.",
  "I follow through without another person checking on me.",
  "I can identify and correct my own training and nutrition mistakes.",
  "I remain consistent when motivation drops or life becomes stressful.",
];

export const ANSWER_LABELS = [
  "Not true at all",
  "Occasionally true",
  "Usually true",
  "Consistently true",
];
