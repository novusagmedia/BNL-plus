/**
 * Signed result tokens — handoff §16.
 *
 * The token identifies a stored submission and nothing else. It must never
 * carry email, phone, answers, consent, caution detail, scores, or price
 * (§9.4, §16.1) — the result page looks all of that up server-side after the
 * signature verifies.
 *
 * HMAC-SHA256 over a compact JSON payload. No dependency, no JWT library:
 * the payload is three fields and the verification rules are short enough to
 * audit by eye, which matters more here than algorithm flexibility.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const TOKEN_VERSION = "v1";

const DEFAULT_TTL_SECONDS = 86_400; // 24h — see the TTL note at the bottom of this file.

function secret() {
  const value = process.env.RESULT_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "RESULT_TOKEN_SECRET is missing or too short (needs >= 32 characters).",
    );
  }
  return value;
}

function ttlSeconds() {
  const raw = Number(process.env.RESULT_TOKEN_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TTL_SECONDS;
}

const base64url = {
  encode: (buffer) => Buffer.from(buffer).toString("base64url"),
  decode: (text) => Buffer.from(text, "base64url"),
};

function sign(payloadSegment) {
  return createHmac("sha256", secret()).update(payloadSegment).digest();
}

/**
 * @param {string} submissionId  The authoritative submission UUID.
 * @param {object} [options]
 * @param {number} [options.now]  Unix seconds; injectable so tests control expiry.
 */
export function createResultToken(submissionId, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof submissionId !== "string" || !submissionId) {
    throw new TypeError("createResultToken requires a submission id.");
  }

  const payload = { submissionId, exp: now + ttlSeconds(), v: TOKEN_VERSION };
  const payloadSegment = base64url.encode(JSON.stringify(payload));
  const signatureSegment = base64url.encode(sign(payloadSegment));

  return `${payloadSegment}.${signatureSegment}`;
}

/**
 * Verify signature, version, and expiry.
 *
 * Returns a discriminated result rather than throwing, because §16.2 requires
 * rejecting altered and expired tokens *without revealing* whether a given
 * submission exists — the caller renders one generic state for every `ok:false`.
 *
 * @returns {{ok: true, submissionId: string, exp: number}
 *          | {ok: false, reason: "malformed"|"bad_signature"|"bad_version"|"expired"}}
 */
export function verifyResultToken(token, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof token !== "string" || token.length > 4096) {
    return { ok: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [payloadSegment, signatureSegment] = parts;

  const expected = sign(payloadSegment);
  const provided = base64url.decode(signatureSegment);
  // Compare before parsing: never interpret a payload we have not authenticated.
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_signature" };

  let payload;
  try {
    payload = JSON.parse(base64url.decode(payloadSegment).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload?.v !== TOKEN_VERSION) return { ok: false, reason: "bad_version" };
  if (typeof payload.submissionId !== "string" || !payload.submissionId) {
    return { ok: false, reason: "malformed" };
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, submissionId: payload.submissionId, exp: payload.exp };
}

export function buildResultUrl(token, { siteUrl = process.env.PUBLIC_SITE_URL } = {}) {
  const base = (siteUrl || "https://bnlch.com").replace(/\/+$/, "");
  return `${base}/restart-assessment/result?token=${encodeURIComponent(token)}`;
}

/* ------------------------------------------------------------------
   TTL NOTE — flagged for BNL Plus, not yet resolved.

   §16.2 sets a 24-hour expiry, but §8.5 stores this signed URL permanently in
   the GoHighLevel field "RA Result Page URL" and the Day 0 email links to it.
   Anyone who opens that email on day two hits a dead link.

   Until that contradiction is settled, RESULT_TOKEN_TTL_SECONDS is
   configurable and the result page must offer the "request a fresh result
   link" path that §16.2 defers to "later".
   ------------------------------------------------------------------ */
