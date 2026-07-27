#!/usr/bin/env node
/**
 * Create the 59 Restart Assessment custom fields in the BNL Plus sub-account,
 * then print the environment variables that map them (handoff §8, §8.6).
 *
 * WHY THIS SCRIPT EXISTS
 * Typing 59 fields into the GoHighLevel UI by hand is slow and, worse, it is
 * exactly where the en-dash trap bites: the site *displays* "18–34" but the CRM
 * value must be "18-34". One wrong character and every contact upsert fails its
 * dropdown match silently. This script sources the values from the same
 * constants the server uses, so the two cannot drift.
 *
 * SAFE TO RE-RUN. Existing fields are matched by name and skipped, never
 * duplicated or overwritten.
 *
 * Usage:
 *   GHL_PRIVATE_INTEGRATION_TOKEN=pit-... node scripts/ghl-setup-fields.mjs
 *   ... --dry-run     show what would be created, change nothing
 *
 * Required scopes: locations/customFields.readonly AND locations/customFields.write
 */

import {
  AGE_RANGES,
  BIGGEST_OBSTACLES,
  CATEGORIES,
  MAIN_GOALS,
  READINESS_LABELS,
  SUPPORT_TIERS,
  TRAINING_ENVIRONMENTS,
  TRAINING_LEVELS,
} from "../api/_lib/constants.mjs";

const TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID || "FGonSmWTAXk5fnQxtwdP";
const BASE = process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";
const VERSION = process.env.GHL_API_VERSION || "2021-07-28";
const DRY_RUN = process.argv.includes("--dry-run");

if (!TOKEN) {
  console.error("GHL_PRIVATE_INTEGRATION_TOKEN is required.");
  process.exit(1);
}

const YES_NO = ["Yes", "No"];

/** envKey is null for fields the server does not write (workflow-managed). */
const text = (name, envKey) => ({ name, dataType: "TEXT", envKey });
const number = (name, envKey) => ({ name, dataType: "NUMERICAL", envKey });
const choice = (name, options, envKey) => ({
  name,
  dataType: "SINGLE_OPTIONS",
  options,
  envKey,
});

const FIELDS = [
  // ---- Submission (16) ----
  text("RA Submission ID", "GHL_FIELD_RA_SUBMISSION_ID"),
  text("RA Submitted At ISO", "GHL_FIELD_RA_SUBMITTED_AT"),
  choice("RA Age Range", AGE_RANGES, "GHL_FIELD_RA_AGE_RANGE"),
  choice("RA Training Environment", TRAINING_ENVIRONMENTS, "GHL_FIELD_RA_TRAINING_ENVIRONMENT"),
  choice("RA Main Goal", MAIN_GOALS, "GHL_FIELD_RA_MAIN_GOAL"),
  choice("RA Biggest Obstacle", BIGGEST_OBSTACLES, "GHL_FIELD_RA_BIGGEST_OBSTACLE"),
  text("RA Source Page", "GHL_FIELD_RA_SOURCE_PAGE"),
  text("RA Referrer", "GHL_FIELD_RA_REFERRER"),
  text("RA UTM Source", "GHL_FIELD_RA_UTM_SOURCE"),
  text("RA UTM Medium", "GHL_FIELD_RA_UTM_MEDIUM"),
  text("RA UTM Campaign", "GHL_FIELD_RA_UTM_CAMPAIGN"),
  text("RA UTM Content", "GHL_FIELD_RA_UTM_CONTENT"),
  text("RA UTM Term", "GHL_FIELD_RA_UTM_TERM"),
  text("RA Assessment Version", "GHL_FIELD_RA_ASSESSMENT_VERSION"),
  text("RA Scoring Version", "GHL_FIELD_RA_SCORING_VERSION"),
  text("RA Result Content Version", "GHL_FIELD_RA_RESULT_CONTENT_VERSION"),

  // ---- Answers (18) ----
  ...Array.from({ length: 18 }, (_, i) => {
    const padded = String(i + 1).padStart(2, "0");
    return number(`RA Q${padded}`, `GHL_FIELD_RA_Q${padded}`);
  }),

  // ---- Scores (8) ----
  number("RA Training Consistency Score", "GHL_FIELD_RA_TRAINING_CONSISTENCY_SCORE"),
  number("RA Strength Confidence Score", "GHL_FIELD_RA_STRENGTH_CONFIDENCE_SCORE"),
  number("RA Nutrition Structure Score", "GHL_FIELD_RA_NUTRITION_STRUCTURE_SCORE"),
  number("RA Energy and Recovery Score", "GHL_FIELD_RA_ENERGY_AND_RECOVERY_SCORE"),
  number("RA Schedule Control Score", "GHL_FIELD_RA_SCHEDULE_CONTROL_SCORE"),
  number("RA Accountability Raw Score", "GHL_FIELD_RA_ACCOUNTABILITY_RAW_SCORE"),
  number("RA Restart Readiness Score", "GHL_FIELD_RA_RESTART_READINESS_SCORE"),
  number("RA Support Need Score", "GHL_FIELD_RA_SUPPORT_NEED_SCORE"),

  // ---- Results & Consent (17) ----
  choice("RA Restart Readiness Label", READINESS_LABELS, "GHL_FIELD_RA_READINESS_LABEL"),
  choice("RA Likely Training Level", TRAINING_LEVELS, "GHL_FIELD_RA_TRAINING_LEVEL"),
  text("RA Program Display", "GHL_FIELD_RA_PROGRAM_DISPLAY"),
  choice("RA Biggest Constraint", CATEGORIES, "GHL_FIELD_RA_BIGGEST_CONSTRAINT"),
  choice("RA Likely Support Tier", SUPPORT_TIERS, "GHL_FIELD_RA_LIKELY_SUPPORT_TIER"),
  number("RA Tier Monthly Price", "GHL_FIELD_RA_TIER_MONTHLY_PRICE"),
  number("RA Tier Total Price", "GHL_FIELD_RA_TIER_TOTAL_PRICE"),
  text("RA Tier Price Display", "GHL_FIELD_RA_TIER_PRICE_DISPLAY"),
  choice("RA Under 18 Flag", YES_NO, "GHL_FIELD_RA_UNDER_18_FLAG"),
  choice("RA Pain Caution Flag", YES_NO, "GHL_FIELD_RA_PAIN_CAUTION_FLAG"),
  choice("RA Email Consent", YES_NO, "GHL_FIELD_RA_EMAIL_CONSENT"),
  choice("RA SMS Consent", YES_NO, "GHL_FIELD_RA_SMS_CONSENT"),
  text("RA Consent Timestamp ISO", "GHL_FIELD_RA_CONSENT_TIMESTAMP"),
  text("RA Result Page URL", "GHL_FIELD_RA_RESULT_PAGE_URL"),
  text("RA Seven-Day Plan URL", "GHL_FIELD_RA_SEVEN_DAY_PLAN_URL"),
  text("RA Last Result Email Submission ID", null),
  text("RA Last Result Email Sent At", null),
];

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

console.log(`Location: ${LOCATION_ID}${DRY_RUN ? "  (DRY RUN — nothing will be created)" : ""}`);
console.log(`Fields defined: ${FIELDS.length}\n`);

const existing = (await api(`/locations/${LOCATION_ID}/customFields`)).customFields || [];
const byName = new Map(existing.map((f) => [f.name, f]));
console.log(`Existing custom fields in account: ${existing.length}\n`);

const resolved = new Map();
let created = 0;
let skipped = 0;
let failed = 0;

for (const field of FIELDS) {
  const already = byName.get(field.name);
  if (already) {
    resolved.set(field.name, already.id);
    skipped += 1;
    console.log(`  = ${field.name.padEnd(38)} exists`);
    continue;
  }

  if (DRY_RUN) {
    console.log(`  + ${field.name.padEnd(38)} would create (${field.dataType})`);
    created += 1;
    continue;
  }

  try {
    const payload = {
      name: field.name,
      dataType: field.dataType,
      model: "contact",
    };
    if (field.options) payload.options = field.options;

    const result = await api(`/locations/${LOCATION_ID}/customFields`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const id = result.customField?.id ?? result.id;
    resolved.set(field.name, id);
    created += 1;
    console.log(`  + ${field.name.padEnd(38)} created  ${id}`);
  } catch (error) {
    failed += 1;
    console.log(`  ! ${field.name.padEnd(38)} FAILED   ${error.status ?? ""} ${error.message}`);
  }

  // Stay well clear of the rate limit; this runs once.
  await new Promise((r) => setTimeout(r, 120));
}

console.log(`\ncreated: ${created}   existing: ${skipped}   failed: ${failed}`);

if (DRY_RUN) process.exit(0);

console.log("\n" + "=".repeat(66));
console.log("Paste these into Vercel → Settings → Environment Variables");
console.log("=".repeat(66));

let missing = 0;
for (const field of FIELDS) {
  if (!field.envKey) continue;
  const id = resolved.get(field.name);
  if (id) console.log(`${field.envKey}=${id}`);
  else {
    console.log(`# ${field.envKey}=  <-- MISSING, field "${field.name}" was not created`);
    missing += 1;
  }
}
if (missing) console.log(`\n${missing} mapping(s) missing — re-run this script to fill them in.`);
