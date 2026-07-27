/**
 * Guards against copy drift between the server's result page and the browser's
 * instant on-screen result.
 *
 * The same locked copy (§3) lives in two places: api/_lib/result-copy.mjs and
 * the inline script in assessment-start.html. There is no build step to share
 * them, so this test parses the HTML and compares. If someone edits one and not
 * the other, this fails — which is the point. Two visitors comparing the page
 * they saw against the email they received must read the same words.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONSTRAINT_COPY,
  LEVEL_COPY,
  READINESS_COPY,
  TIER_COPY,
  CAUTION_COPY,
  UNDER_18_COPY,
} from "./result-copy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(root, "assessment-start.html"), "utf8");

/** Pull a `const NAME = { ... };` object literal out of the inline script. */
function extractObject(name) {
  const start = html.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `${name} not found in assessment-start.html`);

  const open = html.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  // The literal uses plain JS keys and values; evaluating it is safe here
  // because the input is our own committed source file, read from disk.
  return Function(`"use strict"; return (${html.slice(open, end + 1)});`)();
}

/** Compare the browser's copy bank against the server's, entry by entry. */
function assertSameCopy(browserObject, serverObject, fields, label) {
  const browserEntries = Object.values(browserObject);
  const serverEntries = Object.values(serverObject);

  assert.equal(
    browserEntries.length,
    serverEntries.length,
    `${label}: different number of entries`,
  );

  for (const browserEntry of browserEntries) {
    // Match on the first field (title/label/name), which is identical in both.
    const key = fields[0];
    const serverEntry = serverEntries.find((e) => e[key] === browserEntry[key]);
    assert.ok(serverEntry, `${label}: server is missing "${browserEntry[key]}"`);

    for (const field of fields) {
      assert.equal(
        serverEntry[field],
        browserEntry[field],
        `${label} "${browserEntry[key]}" — field "${field}" differs between assessment-start.html and result-copy.mjs`,
      );
    }
  }
}

test("readiness copy matches between the page and the server", () => {
  assertSameCopy(extractObject("READINESS_COPY"), READINESS_COPY, ["title", "copy"], "READINESS_COPY");
});

test("training level copy matches between the page and the server", () => {
  assertSameCopy(extractObject("LEVEL_COPY"), LEVEL_COPY, ["label", "copy"], "LEVEL_COPY");
});

test("constraint copy matches between the page and the server", () => {
  assertSameCopy(extractObject("CONSTRAINT_COPY"), CONSTRAINT_COPY, ["label", "copy"], "CONSTRAINT_COPY");
});

test("tier copy matches between the page and the server", () => {
  assertSameCopy(extractObject("TIER_COPY"), TIER_COPY, ["name", "sugg", "desc"], "TIER_COPY");
});

test("the pain-caution wording matches (§3 health scope)", () => {
  assert.ok(
    html.includes(CAUTION_COPY),
    "CAUTION_COPY does not appear verbatim in assessment-start.html",
  );
});

test("the under-18 wording matches (§3 eligibility)", () => {
  assert.ok(
    html.includes(UNDER_18_COPY),
    "UNDER_18_COPY does not appear verbatim in assessment-start.html",
  );
});

test("every scoring outcome has copy on the server side", async () => {
  const { READINESS_LABELS, TRAINING_LEVELS, SUPPORT_TIERS, CATEGORIES } = await import(
    "./constants.mjs"
  );

  // A missing entry would render a blank card on the result page.
  for (const label of READINESS_LABELS) assert.ok(READINESS_COPY[label], `no copy for readiness "${label}"`);
  for (const level of TRAINING_LEVELS) assert.ok(LEVEL_COPY[level], `no copy for level "${level}"`);
  for (const tier of SUPPORT_TIERS) assert.ok(TIER_COPY[tier], `no copy for tier "${tier}"`);
  for (const category of CATEGORIES) assert.ok(CONSTRAINT_COPY[category], `no copy for constraint "${category}"`);
});
