/**
 * Locked result copy — handoff §3 ("Do not modify … result copy … without
 * Elijah Robles' explicit approval") and §16.4.
 *
 * This is the server-side source for the result page. The same text also lives
 * in assessment-start.html for the instant on-screen result, which is a real
 * drift risk — so result-copy.test.mjs parses that file and fails if the two
 * ever disagree. If you change copy here, change it there, and bump
 * RESULT_CONTENT_VERSION (§24.3).
 *
 * Keyed by the canonical result values produced by scoring.mjs, not by the
 * browser's internal camelCase keys.
 */

export const READINESS_COPY = {
  Restarting: {
    title: "Restarting",
    copy: "You do not need a more advanced plan. You need a clear starting point, lower complexity, and a schedule you can repeat. Your fastest win will come from completing simple actions consistently instead of trying to make up for lost time.",
  },
  Rebuilding: {
    title: "Rebuilding",
    copy: "You are not starting from zero, but your current system is not strong enough to survive busy weeks. Your fastest win will come from turning scattered effort into a repeatable training and nutrition structure.",
  },
  "Ready to Progress": {
    title: "Ready to Progress",
    copy: "You already have several useful habits. Your next result will come from better progression, precision, and accountability rather than simply doing more. Your fastest win will come from identifying the weakest link and applying a more deliberate system.",
  },
};

export const LEVEL_COPY = {
  Foundation: {
    label: "Foundation",
    copy: "You are most likely to succeed with lower complexity, conservative volume, and time to rebuild movement confidence.",
  },
  Build: {
    label: "Build",
    copy: "You likely have enough experience for a moderate program, but you need consistent progression and recovery rules.",
  },
  Performance: {
    label: "Performance",
    copy: "You may be ready for higher progression demands, provided recent training, technique, and recovery support it.",
  },
};

export const CONSTRAINT_COPY = {
  "Training Consistency": {
    label: "Training Consistency",
    copy: "Your current routine breaks too easily after missed sessions. Protect three realistic workout appointments and use a clear return-to-plan rule.",
  },
  "Strength Confidence": {
    label: "Strength Confidence",
    copy: "You are uncertain about exercise selection, starting loads, or progression. Use a level-appropriate program and record clean repetitions before chasing heavier weight.",
  },
  "Nutrition Structure": {
    label: "Nutrition Structure",
    copy: "Your meals are not repeatable enough during busy weeks and weekends. Build three protein-centered meals you can repeat.",
  },
  "Energy and Recovery": {
    label: "Energy and Recovery",
    copy: "Training demand and recovery are not working together. Protect sleep, hydration, meal consistency, and a conservative starting workload.",
  },
  "Schedule Control": {
    label: "Schedule Control",
    copy: "Your workouts do not yet have protected times and backup options. Choose exact appointments and a minimum plan for disrupted weeks.",
  },
  Accountability: {
    label: "Accountability",
    copy: "You struggle to follow through when motivation drops. Create visible commitments, weekly review, and enough support to prevent one bad day from becoming a lost month.",
  },
};

export const TIER_COPY = {
  Essentials: {
    name: "Body Rebuild Essentials",
    sugg: "Your answers suggest that you can execute independently when the correct plan is in front of you.",
    desc: "Essentials gives you the 16-week program, progression rules, nutrition foundations, and self-directed tools without coaching calls or individual adjustments.",
  },
  Coaching: {
    name: "Body Rebuild Coaching",
    sugg: "Your answers suggest that a plan alone may not be enough. Weekly feedback and accountability are likely to improve your follow-through.",
    desc: "Coaching adds personalized starting targets, weekly written review, one form video per week, group accountability, and data-based adjustments.",
  },
  Private: {
    name: "Body Rebuild Private",
    sugg: "Your answers suggest that you are more likely to succeed with private accountability, faster feedback, and more individualized problem-solving.",
    desc: "Private adds weekly 1:1 coaching, same-business-day support, deeper training and nutrition adjustments, up to two form videos per week, and one monthly live training session.",
  },
};

/** Display labels for the category bars. Note the ampersand — site copy, not CRM. */
export const CAT_DISPLAY = {
  trainingConsistency: "Training Consistency",
  strengthConfidence: "Strength Confidence",
  nutritionStructure: "Nutrition Structure",
  energyAndRecovery: "Energy & Recovery",
  scheduleControl: "Schedule Control",
  accountabilityRaw: "Accountability",
};

/** §3 — shown whenever the visitor flagged a pain or health concern. */
export const CAUTION_COPY =
  "You selected a pain or health concern as your biggest obstacle. BNL Plus may modify exercises within fitness-coaching scope, but it does not diagnose injuries or provide rehabilitation. Medical clearance may be required before participation.";

/** §3 — applicants must be 18+; the result and plan are still delivered. */
export const UNDER_18_COPY =
  "Applicants must be at least 18. Save your Seven-Day Plan and revisit Body Rebuild when you are eligible to apply.";
