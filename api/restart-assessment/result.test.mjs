/**
 * Result page — handoff §16.2, §16.4, §22.2.
 *
 * Run: npm test
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.RESULT_TOKEN_SECRET =
  process.env.RESULT_TOKEN_SECRET || "test-secret-value-at-least-32-chars-long";
process.env.PUBLIC_SITE_URL = "https://www.bnlch.com";

const { renderResult, renderUnavailable } = await import("./result.mjs");
const { calculateAssessment } = await import("../_lib/scoring.mjs");

function submissionFor({ answers = new Array(18).fill(2), context = {}, firstName = "Dana" } = {}) {
  const ctx = {
    biggestObstacle: "Schedule",
    trainingEnvironment: "Gym",
    ageRange: "35-44",
    ...context,
  };
  const { scores, results } = calculateAssessment(answers, ctx);
  return { id: "sub-1", firstName, scores, results };
}

/* ============================================================
   §16.4 — required content
   ============================================================ */

test("the page shows every element §16.4 requires", () => {
  const html = renderResult(submissionFor());

  assert.match(html, /Rebuilding/, "readiness label");
  assert.match(html, /30<span[^>]*>\/45/, "readiness score out of 45");
  assert.match(html, /Build/, "training level");
  assert.match(html, /Build - Gym Track/, "environment-specific program display");
  assert.match(html, /Schedule Control/, "biggest constraint");
  assert.match(html, /Body Rebuild Coaching/, "likely support tier");
  assert.match(html, /\$229\/month × 4 — \$916 total/, "exact four-payment price");
  assert.match(html, /Find My Best Body Rebuild Tier/, "primary CTA");
  assert.match(html, /Download My Seven-Day Restart Plan/, "secondary CTA");
});

test("all six category scores are rendered", () => {
  const html = renderResult(submissionFor());

  for (const label of [
    "Training Consistency", "Strength Confidence", "Nutrition Structure",
    "Energy &amp; Recovery", "Schedule Control", "Accountability",
  ]) {
    assert.ok(html.includes(label), `missing category "${label}"`);
  }
});

test("the visitor's first name is greeted", () => {
  assert.match(renderResult(submissionFor({ firstName: "Marcus" })), /Marcus, your result is ready\./);
});

/* ============================================================
   §3 — safety routing
   ============================================================ */

test("ROUTE-001: an under-18 result keeps the plan but loses the paid CTA", () => {
  const html = renderResult(submissionFor({ context: { ageRange: "Under 18" } }));

  assert.ok(!html.includes("Find My Best Body Rebuild Tier"), "paid CTA must be removed");
  assert.match(html, /Download My Seven-Day Restart Plan/, "the plan is still delivered");
  assert.match(html, /Applicants must be at least 18/);
});

test("an adult result keeps the application CTA", () => {
  assert.match(renderResult(submissionFor()), /Find My Best Body Rebuild Tier/);
});

test("ROUTE-002: a pain concern shows the caution language and no clearance claim", () => {
  const html = renderResult(submissionFor({ context: { biggestObstacle: "Pain or concern" } }));

  assert.match(html, /does not diagnose injuries or provide rehabilitation/);
  assert.ok(!/cleared to train/i.test(html), "must not imply medical clearance");
});

test("no caution block appears when there is no concern", () => {
  assert.ok(!renderResult(submissionFor()).includes("does not diagnose injuries"));
});

/* ============================================================
   §15.2 — cohort messaging
   ============================================================ */

test("the cohort line appears only for the Coaching tier", () => {
  // All 2s -> supportNeed 3 -> Coaching
  assert.match(renderResult(submissionFor()), /id="r-cohort"/);

  // All 3s -> supportNeed 0 -> Essentials
  const essentials = renderResult(submissionFor({ answers: new Array(18).fill(3) }));
  assert.ok(!essentials.includes('id="r-cohort"'));
});

test("the rendered cohort line carries no hardcoded date", () => {
  const html = renderResult(submissionFor());
  const line = html.slice(html.indexOf('id="r-cohort"'), html.indexOf('id="r-cohort"') + 300);

  assert.ok(!/August|September|\b20\d\d\b/.test(line), "must be evergreen; cohort.js adds dates");
});

/* ============================================================
   §22.2 test 23 — hostile input must not break the page
   ============================================================ */

test("a first name containing markup is escaped, not executed", () => {
  const html = renderResult(submissionFor({ firstName: '<img src=x onerror="alert(1)">' }));

  assert.ok(!html.includes("<img src=x"), "raw markup must not survive");
  assert.ok(!html.includes('onerror="alert(1)"'));
  assert.match(html, /&lt;img src=x/);
});

test("names with apostrophes and accents render safely", () => {
  const html = renderResult(submissionFor({ firstName: "O'Brien-Ríos" }));

  assert.match(html, /O&#39;Brien-Ríos/);
});

/* ============================================================
   §16.2 — failure states reveal nothing
   ============================================================ */

test("the unavailable page offers a route forward without leaking anything", () => {
  const html = renderUnavailable();

  assert.match(html, /no longer available/i);
  assert.match(html, /Take the Assessment Again/);

  // Must not hint at *why* it failed — a forged token and an expired one look
  // identical, so nobody can probe for which submissions exist.
  for (const leak of ["expired", "not found", "invalid signature", "does not exist"]) {
    assert.ok(!html.toLowerCase().includes(leak), `must not disclose "${leak}"`);
  }

  // No contact address should be interpolated into the failure page.
  assert.ok(
    !/[\w.+-]+@[\w-]+\.[\w.]+/.test(html.replace(/@media[^{]*/g, "")),
    "must not contain an email address",
  );
});

/* ============================================================
   Privacy and indexing
   ============================================================ */

test("the result page is never indexable", () => {
  assert.match(renderResult(submissionFor()), /name="robots" content="noindex, nofollow"/);
});

test("no answer values or consent data appear in the markup", () => {
  const html = renderResult(submissionFor());

  // Scores and labels are fine; raw per-question answers and consent are not.
  assert.ok(!html.includes("emailConsent"));
  assert.ok(!html.includes("smsConsent"));
  assert.ok(!/\bq1[0-8]?\b/.test(html), "raw answer keys must not be rendered");
});

test("reduced motion is respected", () => {
  assert.match(renderResult(submissionFor()), /prefers-reduced-motion/);
});
