/**
 * Result-token fixtures — handoff appendix D (TOKEN-001, TOKEN-002) and §16.2.
 *
 * Run: node --test "api/_lib/*.test.mjs"
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.RESULT_TOKEN_SECRET =
  process.env.RESULT_TOKEN_SECRET || "test-secret-value-at-least-32-chars-long";

const { createResultToken, verifyResultToken, buildResultUrl, TOKEN_VERSION } = await import(
  "./result-token.mjs"
);

const SUBMISSION_ID = "17f2a026-29d2-4d45-94fc-649a72b08175";

function payloadOf(token) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

test("a freshly issued token verifies and returns its submission id", () => {
  const token = createResultToken(SUBMISSION_ID);
  const result = verifyResultToken(token);

  assert.equal(result.ok, true);
  assert.equal(result.submissionId, SUBMISSION_ID);
});

test("TOKEN-001: an altered payload is rejected", () => {
  const token = createResultToken(SUBMISSION_ID);
  const [, signature] = token.split(".");

  const forged = Buffer.from(
    JSON.stringify({ submissionId: "somebody-elses-id", exp: 9_999_999_999, v: TOKEN_VERSION }),
  ).toString("base64url");

  const result = verifyResultToken(`${forged}.${signature}`);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "bad_signature");
});

test("TOKEN-001: an altered signature is rejected", () => {
  const token = createResultToken(SUBMISSION_ID);
  const [payload, signature] = token.split(".");

  // Flip one character of the signature.
  const tampered = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
  const result = verifyResultToken(`${payload}.${tampered}`);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "bad_signature");
});

test("TOKEN-002: an expired token is rejected safely", () => {
  const issuedAt = 1_700_000_000;
  const token = createResultToken(SUBMISSION_ID, { now: issuedAt });

  const { exp } = payloadOf(token);
  const result = verifyResultToken(token, { now: exp + 1 });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired");
});

test("a token is still valid one second before it expires", () => {
  const token = createResultToken(SUBMISSION_ID, { now: 1_700_000_000 });
  const { exp } = payloadOf(token);

  assert.equal(verifyResultToken(token, { now: exp - 1 }).ok, true);
});

test("a token signed with a different secret is rejected", async () => {
  const token = createResultToken(SUBMISSION_ID);

  const original = process.env.RESULT_TOKEN_SECRET;
  process.env.RESULT_TOKEN_SECRET = "a-completely-different-secret-32-chars";
  const result = verifyResultToken(token);
  process.env.RESULT_TOKEN_SECRET = original;

  assert.equal(result.ok, false);
  assert.equal(result.reason, "bad_signature");
});

test("malformed input is rejected without throwing", () => {
  for (const input of ["", "not-a-token", "a.b.c", null, undefined, 42, {}]) {
    const result = verifyResultToken(input);
    assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(input)}`);
  }
});

test("§16.1: the token carries no personal, health, or pricing data", () => {
  const token = createResultToken(SUBMISSION_ID);
  const payload = payloadOf(token);

  assert.deepEqual(Object.keys(payload).sort(), ["exp", "submissionId", "v"]);

  const decoded = JSON.stringify(payload).toLowerCase();
  for (const forbidden of ["email", "phone", "consent", "score", "price", "pain", "answer"]) {
    assert.ok(!decoded.includes(forbidden), `token must not contain "${forbidden}"`);
  }
});

test("the result URL points at the configured site and escapes the token", () => {
  const url = buildResultUrl("abc.def", { siteUrl: "https://bnlch.com/" });

  assert.equal(url, "https://bnlch.com/restart-assessment/result?token=abc.def");
});

test("a missing or weak secret fails loudly rather than signing with a default", () => {
  const original = process.env.RESULT_TOKEN_SECRET;

  delete process.env.RESULT_TOKEN_SECRET;
  assert.throws(() => createResultToken(SUBMISSION_ID), /RESULT_TOKEN_SECRET/);

  process.env.RESULT_TOKEN_SECRET = "too-short";
  assert.throws(() => createResultToken(SUBMISSION_ID), /RESULT_TOKEN_SECRET/);

  process.env.RESULT_TOKEN_SECRET = original;
});
