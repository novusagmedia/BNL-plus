/**
 * Identity normalization — handoff §11.2.
 *
 * Everything stored or sent to GoHighLevel passes through here first. The point
 * is that "Elijah@Gmail.com " and "elijah@gmail.com" must collapse to one
 * contact under the sub-account's email-first duplicate rule (§7.1); if they
 * don't, the CRM quietly grows two records for the same person.
 */

/** Drop C0/C1 control characters, which must never reach storage or email. */
function stripControlChars(value) {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    const isC0 = code < 32;
    const isC1 = code >= 127 && code <= 159;
    if (!isC0 && !isC1) out += char;
  }
  return out;
}

/** Strip control characters, collapse internal whitespace, trim, and cap length. */
export function normalizeText(value, { maxLength = 500 } = {}) {
  if (typeof value !== "string") return "";
  return stripControlChars(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(value) {
  return normalizeText(value, { maxLength: 254 }).toLowerCase();
}

/**
 * Rough shape check only. Deliverability is proven by the Day 0 email actually
 * arriving, not by a regex — so this stays permissive enough to accept valid
 * addresses and strict enough to catch typos and empty input.
 */
export function isValidEmail(value) {
  if (typeof value !== "string" || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Normalize to E.164 (§11.2).
 *
 * Scoped to the North American Numbering Plan, which is what BNL Plus serves.
 * Numbers already in international form are accepted after a length check.
 * Returns null when the input cannot be resolved confidently — the caller turns
 * that into a field error rather than storing a guess.
 */
export function normalizePhone(value, { defaultCountryCode = "1" } = {}) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  // Already international and not NANP — accept without national-format rules.
  if (hasPlus && !digits.startsWith(defaultCountryCode)) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  let national = digits;
  if (national.length === 11 && national.startsWith("1")) {
    national = national.slice(1);
  }

  if (national.length !== 10) return null;
  if (!isValidNanpNumber(national)) return null;

  return `+1${national}`;
}

/** NANP area codes and exchange codes may not begin with 0 or 1. */
function isValidNanpNumber(national) {
  const areaCode = national.slice(0, 3);
  const exchange = national.slice(3, 6);
  return !/^[01]/.test(areaCode) && !/^[01]/.test(exchange);
}

/**
 * Attribution values arrive from the query string and are echoed into the CRM,
 * so they are length-capped and stripped of anything that could break a merge
 * field or smuggle markup into an email template.
 */
export function normalizeAttributionValue(value) {
  return normalizeText(value, { maxLength: 255 }).replace(/[<>]/g, "");
}

/** URLs are stored and rendered; only http(s) is ever acceptable. */
export function normalizeUrl(value, { maxLength = 500 } = {}) {
  const text = normalizeText(value, { maxLength });
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
