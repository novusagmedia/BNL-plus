/**
 * Authoritative scoring engine — handoff §12.
 *
 * Pure and dependency-free on purpose: no I/O, no clock, no randomness, no CRM.
 * Given the same answers it must return the same result forever, because the
 * scoring version is stamped onto every stored submission and every CRM contact.
 *
 * The browser runs equivalent logic for instant on-screen feedback, but this
 * module is the one that decides what gets stored and what GoHighLevel receives
 * (§4 — "browser values can be edited, replayed, or tampered with").
 */

import {
  CATEGORY_QUESTIONS,
  CONSTRAINT_FALLBACK_ORDER,
  OBSTACLE_TO_CATEGORY,
  READINESS_QUESTION_COUNT,
  TIER_PRICING,
} from "./constants.mjs";

/**
 * @param {number[]} answers  Exactly 18 integers, each 0–3, in question order.
 * @param {object}   context
 * @param {string}   context.biggestObstacle    Canonical obstacle value.
 * @param {string}   context.trainingEnvironment Canonical environment value.
 * @param {string}   context.ageRange            Canonical age-range value.
 */
export function calculateAssessment(answers, context) {
  assertAnswers(answers);

  const categories = {};
  for (const [name, indices] of Object.entries(CATEGORY_QUESTIONS)) {
    categories[name] = indices.reduce((total, i) => total + answers[i], 0);
  }

  const restartReadiness = answers
    .slice(0, READINESS_QUESTION_COUNT)
    .reduce((total, value) => total + value, 0);

  const accountabilityRaw = categories.Accountability;
  const supportNeed = 9 - accountabilityRaw;

  const readinessLabel = resolveReadinessLabel(restartReadiness);
  const trainingLevel = resolveTrainingLevel(restartReadiness, categories);
  const likelySupportTier = resolveSupportTier(supportNeed);
  const biggestConstraint = resolveConstraint(categories, context.biggestObstacle);
  const programDisplay = resolveProgramDisplay(trainingLevel, context.trainingEnvironment);

  return {
    scores: {
      trainingConsistency: categories["Training Consistency"],
      strengthConfidence: categories["Strength Confidence"],
      nutritionStructure: categories["Nutrition Structure"],
      energyAndRecovery: categories["Energy and Recovery"],
      scheduleControl: categories["Schedule Control"],
      accountabilityRaw,
      restartReadiness,
      supportNeed,
    },
    results: {
      readinessLabel,
      trainingLevel,
      programDisplay,
      biggestConstraint,
      likelySupportTier,
      ...TIER_PRICING[likelySupportTier],
      under18: context.ageRange === "Under 18",
      painCaution: context.biggestObstacle === "Pain or concern",
    },
  };
}

/* §12.3 */
function resolveReadinessLabel(restartReadiness) {
  if (restartReadiness <= 15) return "Restarting";
  if (restartReadiness <= 30) return "Rebuilding";
  return "Ready to Progress";
}

/* §12.4 — order matters; rule 2 deliberately overrides rule 3 so that someone
   with high overall readiness but no lifting confidence still starts at Foundation. */
function resolveTrainingLevel(restartReadiness, categories) {
  if (restartReadiness <= 15) return "Foundation";
  if (categories["Strength Confidence"] <= 3) return "Foundation";
  if (
    restartReadiness >= 31 &&
    categories["Strength Confidence"] >= 8 &&
    categories["Training Consistency"] >= 7
  ) {
    return "Performance";
  }
  return "Build";
}

/* §12.5 */
function resolveSupportTier(supportNeed) {
  if (supportNeed <= 2) return "Essentials";
  if (supportNeed <= 6) return "Coaching";
  return "Private";
}

/* §12.6 — lowest category wins; ties defer to the visitor's stated obstacle,
   and only then to the fixed fallback order. */
function resolveConstraint(categories, biggestObstacle) {
  const lowest = Math.min(...Object.values(categories));
  const tied = Object.keys(categories).filter((name) => categories[name] === lowest);

  const mapped = OBSTACLE_TO_CATEGORY[biggestObstacle];
  if (mapped && tied.includes(mapped)) return mapped;

  return CONSTRAINT_FALLBACK_ORDER.find((name) => tied.includes(name));
}

/* §12.7 */
function resolveProgramDisplay(trainingLevel, trainingEnvironment) {
  switch (trainingEnvironment) {
    case "Home":
      return `${trainingLevel} - Home Track`;
    case "Gym":
      return `${trainingLevel} - Gym Track`;
    case "Both":
      return `${trainingLevel} - Home or Gym; confirm primary environment later`;
    default:
      return `${trainingLevel} - Environment to be confirmed`;
  }
}

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 18) {
    throw new TypeError("Scoring requires exactly 18 answers.");
  }
  for (const [i, value] of answers.entries()) {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new RangeError(`Answer Q${i + 1} must be an integer 0-3, received ${value}.`);
    }
  }
}
