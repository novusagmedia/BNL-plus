/**
 * Locked scoring fixtures — handoff §22.1 and appendix D.
 *
 * These assertions encode business rules approved by BNL Plus. A failure here
 * means either the scoring changed without approval, or a change was approved
 * and SCORING_VERSION needs to be bumped (§24.3). Never "fix" a test by
 * loosening it.
 *
 * Run: node --test api/_lib/
 */

import test from "node:test";
import assert from "node:assert/strict";

import { calculateAssessment } from "./scoring.mjs";

/** Build the 18 answers from six 3-question category blocks, in order. */
function answersFrom({ tc, sc, ns, er, sched, acc }) {
  return [...tc, ...sc, ...ns, ...er, ...sched, ...acc];
}

const fill = (value) => new Array(18).fill(value);

const baseContext = {
  biggestObstacle: "Schedule",
  trainingEnvironment: "Gym",
  ageRange: "35-44",
};

const score = (answers, context = {}) =>
  calculateAssessment(answers, { ...baseContext, ...context });

/* ============================================================
   Appendix D — required scoring fixtures
   ============================================================ */

test("SCORE-001: all answers 0 → Restarting / Foundation / Private", () => {
  const { scores, results } = score(fill(0));

  assert.equal(scores.restartReadiness, 0);
  assert.equal(scores.supportNeed, 9);
  assert.equal(results.readinessLabel, "Restarting");
  assert.equal(results.trainingLevel, "Foundation");
  assert.equal(results.likelySupportTier, "Private");
  assert.equal(results.monthlyPrice, 499);
  assert.equal(results.totalPrice, 1996);
});

test("SCORE-002: all answers 2 → Rebuilding / Build / Coaching", () => {
  const { scores, results } = score(fill(2));

  // 15 scored questions x 2 = 30, the top of the Rebuilding band.
  assert.equal(scores.restartReadiness, 30);
  assert.equal(scores.supportNeed, 3);
  assert.equal(results.readinessLabel, "Rebuilding");
  assert.equal(results.trainingLevel, "Build");
  assert.equal(results.likelySupportTier, "Coaching");
  assert.equal(results.monthlyPrice, 229);
  assert.equal(results.totalPrice, 916);
});

test("SCORE-003: all answers 3 → Ready to Progress / Performance / Essentials", () => {
  const { scores, results } = score(fill(3));

  assert.equal(scores.restartReadiness, 45);
  assert.equal(scores.supportNeed, 0);
  assert.equal(results.readinessLabel, "Ready to Progress");
  assert.equal(results.trainingLevel, "Performance");
  assert.equal(results.likelySupportTier, "Essentials");
  assert.equal(results.monthlyPrice, 149);
  assert.equal(results.totalPrice, 596);
});

test("SCORE-004: high readiness but Strength Confidence 3 → Foundation override", () => {
  const answers = answersFrom({
    tc: [3, 3, 3],
    sc: [1, 1, 1], // 3 — triggers the override
    ns: [3, 3, 3],
    er: [3, 3, 3],
    sched: [3, 3, 3],
    acc: [3, 3, 3],
  });
  const { scores, results } = score(answers);

  assert.equal(scores.restartReadiness, 39);
  assert.equal(scores.strengthConfidence, 3);
  // Readiness alone would suggest Performance; the override must win.
  assert.equal(results.readinessLabel, "Ready to Progress");
  assert.equal(results.trainingLevel, "Foundation");
});

test("SCORE-005: Performance readiness but Training Consistency 6 → Build", () => {
  const answers = answersFrom({
    tc: [2, 2, 2], // 6 — one short of the Performance gate
    sc: [3, 3, 3],
    ns: [3, 3, 3],
    er: [3, 3, 3],
    sched: [3, 3, 3],
    acc: [3, 3, 3],
  });
  const { scores, results } = score(answers);

  assert.equal(scores.restartReadiness, 42);
  assert.equal(scores.trainingConsistency, 6);
  assert.equal(scores.strengthConfidence, 9);
  assert.equal(results.trainingLevel, "Build");
});

test("ROUTE-001: Age Range Under 18 sets the under-18 flag", () => {
  const { results } = score(fill(2), { ageRange: "Under 18" });

  assert.equal(results.under18, true);
  // The educational result is still produced — only the paid CTA is withheld.
  assert.equal(results.readinessLabel, "Rebuilding");
  assert.ok(results.programDisplay);
});

test("ROUTE-002: obstacle Pain or concern sets the caution flag", () => {
  const { results } = score(fill(2), { biggestObstacle: "Pain or concern" });

  assert.equal(results.painCaution, true);
  assert.equal(results.biggestConstraint, "Energy and Recovery");
});

test("under-18 and pain-caution flags stay false for an ordinary adult", () => {
  const { results } = score(fill(2));

  assert.equal(results.under18, false);
  assert.equal(results.painCaution, false);
});

/* ============================================================
   §12.2 — category formulas and band boundaries
   ============================================================ */

test("each category sums its own three questions", () => {
  // Distinct per-block values prove no block bleeds into another.
  const answers = answersFrom({
    tc: [1, 1, 1],
    sc: [2, 2, 2],
    ns: [3, 3, 3],
    er: [0, 0, 0],
    sched: [1, 2, 3],
    acc: [2, 2, 2],
  });
  const { scores } = score(answers);

  assert.equal(scores.trainingConsistency, 3);
  assert.equal(scores.strengthConfidence, 6);
  assert.equal(scores.nutritionStructure, 9);
  assert.equal(scores.energyAndRecovery, 0);
  assert.equal(scores.scheduleControl, 6);
  assert.equal(scores.accountabilityRaw, 6);
});

test("Restart Readiness excludes Accountability (Q16-Q18)", () => {
  const answers = answersFrom({
    tc: [0, 0, 0],
    sc: [0, 0, 0],
    ns: [0, 0, 0],
    er: [0, 0, 0],
    sched: [0, 0, 0],
    acc: [3, 3, 3], // maxed, must not move readiness off zero
  });
  const { scores } = score(answers);

  assert.equal(scores.restartReadiness, 0);
  assert.equal(scores.accountabilityRaw, 9);
  assert.equal(scores.supportNeed, 0);
});

test("readiness band boundaries land on the documented side", () => {
  const atReadiness = (target) => {
    // Distribute `target` points across the 15 scored questions.
    const answers = fill(0);
    let remaining = target;
    for (let i = 0; i < 15 && remaining > 0; i++) {
      const value = Math.min(3, remaining);
      answers[i] = value;
      remaining -= value;
    }
    return score(answers).results.readinessLabel;
  };

  assert.equal(atReadiness(15), "Restarting");
  assert.equal(atReadiness(16), "Rebuilding");
  assert.equal(atReadiness(30), "Rebuilding");
  assert.equal(atReadiness(31), "Ready to Progress");
});

test("support tier boundaries land on the documented side", () => {
  const atSupportNeed = (supportNeed) => {
    const accountability = 9 - supportNeed;
    const answers = fill(0);
    let remaining = accountability;
    for (let i = 15; i < 18 && remaining > 0; i++) {
      const value = Math.min(3, remaining);
      answers[i] = value;
      remaining -= value;
    }
    return score(answers).results.likelySupportTier;
  };

  assert.equal(atSupportNeed(2), "Essentials");
  assert.equal(atSupportNeed(3), "Coaching");
  assert.equal(atSupportNeed(6), "Coaching");
  assert.equal(atSupportNeed(7), "Private");
});

/* ============================================================
   §12.6 — biggest constraint and tie-breaking
   ============================================================ */

test("the single lowest category is the constraint regardless of obstacle", () => {
  const answers = answersFrom({
    tc: [3, 3, 3],
    sc: [3, 3, 3],
    ns: [0, 0, 1], // clear minimum
    er: [3, 3, 3],
    sched: [3, 3, 3],
    acc: [3, 3, 3],
  });
  // Obstacle points elsewhere; it must not override an untied minimum.
  const { results } = score(answers, { biggestObstacle: "Schedule" });

  assert.equal(results.biggestConstraint, "Nutrition Structure");
});

test("a tie is broken by the stated obstacle when it maps to a tied category", () => {
  const answers = answersFrom({
    tc: [3, 3, 3],
    sc: [0, 0, 0], // tied low
    ns: [3, 3, 3],
    er: [3, 3, 3],
    sched: [0, 0, 0], // tied low
    acc: [3, 3, 3],
  });

  assert.equal(
    score(answers, { biggestObstacle: "Unsure what to do" }).results.biggestConstraint,
    "Strength Confidence",
  );
  assert.equal(
    score(answers, { biggestObstacle: "Schedule" }).results.biggestConstraint,
    "Schedule Control",
  );
});

test("a tie falls back to the fixed order when the obstacle does not map into it", () => {
  const answers = answersFrom({
    tc: [0, 0, 0], // tied low
    sc: [3, 3, 3],
    ns: [0, 0, 0], // tied low
    er: [3, 3, 3],
    sched: [3, 3, 3],
    acc: [3, 3, 3],
  });
  // Nutrition ties, but Training Consistency precedes it in the fallback order
  // and the obstacle "Other" maps nowhere.
  assert.equal(
    score(answers, { biggestObstacle: "Other" }).results.biggestConstraint,
    "Training Consistency",
  );
});

test("obstacle Pain or concern maps to Energy and Recovery for tie-breaking", () => {
  const answers = answersFrom({
    tc: [3, 3, 3],
    sc: [3, 3, 3],
    ns: [0, 0, 0], // tied low
    er: [0, 0, 0], // tied low
    sched: [3, 3, 3],
    acc: [3, 3, 3],
  });
  const { results } = score(answers, { biggestObstacle: "Pain or concern" });

  assert.equal(results.biggestConstraint, "Energy and Recovery");
  assert.equal(results.painCaution, true);
});

test("a constraint is always resolved, even when every category ties", () => {
  const { results } = score(fill(1), { biggestObstacle: "Other" });

  assert.equal(results.biggestConstraint, "Schedule Control"); // first in fallback order
});

/* ============================================================
   §12.7 — program display
   ============================================================ */

test("program display names the environment-specific track", () => {
  const cases = {
    Home: "Build - Home Track",
    Gym: "Build - Gym Track",
    Both: "Build - Home or Gym; confirm primary environment later",
    "Not sure": "Build - Environment to be confirmed",
  };

  for (const [trainingEnvironment, expected] of Object.entries(cases)) {
    const { results } = score(fill(2), { trainingEnvironment });
    assert.equal(results.trainingLevel, "Build");
    assert.equal(results.programDisplay, expected);
  }
});

/* ============================================================
   Input guards — the server must never score a malformed payload
   ============================================================ */

test("answers outside 0-3 are rejected", () => {
  const tooHigh = fill(2);
  tooHigh[7] = 4;
  assert.throws(() => score(tooHigh), RangeError);

  const negative = fill(2);
  negative[0] = -1;
  assert.throws(() => score(negative), RangeError);
});

test("non-integer answers are rejected", () => {
  const fractional = fill(2);
  fractional[3] = 1.5;
  assert.throws(() => score(fractional), RangeError);

  const stringy = fill(2);
  stringy[3] = "2";
  assert.throws(() => score(stringy), RangeError);
});

test("a missing or short answer set is rejected", () => {
  assert.throws(() => score(new Array(17).fill(2)), TypeError);
  assert.throws(() => score(new Array(19).fill(2)), TypeError);
  assert.throws(() => score(null), TypeError);
});

/* ============================================================
   Determinism — scoring is stamped with a version and stored forever
   ============================================================ */

test("scoring is pure: repeated calls on the same input are identical", () => {
  const answers = answersFrom({
    tc: [1, 2, 3],
    sc: [0, 1, 2],
    ns: [3, 2, 1],
    er: [2, 2, 2],
    sched: [1, 1, 1],
    acc: [0, 3, 1],
  });

  const first = score(answers);
  const second = score(answers);

  assert.deepEqual(first, second);
});

test("scoring does not mutate the caller's answers", () => {
  const answers = fill(2);
  const snapshot = [...answers];

  score(answers);

  assert.deepEqual(answers, snapshot);
});
