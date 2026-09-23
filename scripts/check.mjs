// Pre-deploy checks. Run after `npm run generate`; every check must pass before
// asking to deploy. Visual review misses things these catch.
//
// Run: npm run check

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SITE, TIERS, NEVER_WRITE } from "../site/facts.mjs";
import { header, footer } from "../site/chrome.mjs";
import { TITLE_MAX, DESC_MAX, faqText, FAQ_ITEM_RE } from "../site/article.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const exists = (f) => fs.existsSync(path.join(root, f));

const pages = [
  ...fs.readdirSync(root).filter((f) => f.endsWith(".html")),
  ...(exists("guides") ? fs.readdirSync(path.join(root, "guides")).filter((f) => f.endsWith(".html")).map((f) => `guides/${f}`) : []),
];
const html = Object.fromEntries(pages.map((p) => [p, read(p)]));
const indexable = pages.filter((p) => !/name="robots" content="[^"]*noindex/.test(html[p]));
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");

// Funnel utility pages keep their own stripped-down header and footer.
const UTILITY_PAGES = new Set(["404.html", "assessment-start.html", "seven-day-plan.html", "payment.html"]);

const results = [];
function check(name, fn) {
  const problems = [];
  const info = fn((msg) => problems.push(msg));
  results.push({ name, problems, info });
}

// ---- 1. Internal links resolve ------------------------------------------------------

function resolves(href, fromPage) {
  let p = href.split(/[?#]/)[0];
  if (!p) return true; // pure #anchor
  if (!p.startsWith("/")) p = "/" + path.posix.join(path.posix.dirname(fromPage), p);
  if (p === "/") return exists("index.html");
  if (p.startsWith("/_vercel/")) return true;
  if (p === "/restart-assessment/result") return exists("api/restart-assessment/result.mjs");
  if (p.startsWith("/api/")) return exists(`${p.slice(1)}.mjs`);
  const clean = p.replace(/\/$/, "").slice(1);
  return exists(clean) && fs.statSync(path.join(root, clean)).isFile() ? true : exists(`${clean}.html`);
}

check("Internal links resolve", (fail) => {
  let n = 0;
  for (const p of pages) {
    for (const [, href] of html[p].matchAll(/href="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|sms:)/.test(href)) continue;
      n++;
      if (!resolves(href, p)) fail(`${p}: ${href}`);
    }
  }
  return `${n} links across ${pages.length} pages`;
});

// ---- 2. Every image and media file exists -----------------------------------------------

check("Image and media files exist", (fail) => {
  let n = 0;
  for (const p of pages) {
    const srcs = [
      ...[...html[p].matchAll(/<(?:img|source|video)[^>]+(?:src|poster)="([^"]+)"/g)].map((m) => m[1]),
      ...[...html[p].matchAll(/property="og:image" content="([^"]+)"/g)].map((m) => m[1].replace(SITE, "")),
    ];
    for (const src of srcs) {
      if (/^https?:/.test(src) || src.startsWith("data:")) continue;
      n++;
      if (!resolves(src, p)) fail(`${p}: ${src}`);
    }
  }
  return `${n} references`;
});

// ---- 3. Title and meta description lengths ----------------------------------------------

check(`Titles <= ${TITLE_MAX} chars, descriptions <= ${DESC_MAX} chars`, (fail) => {
  for (const p of indexable) {
    const title = html[p].match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const desc = html[p].match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    if (!title) fail(`${p}: no <title>`);
    if (title.length > TITLE_MAX) fail(`${p}: title is ${title.length} chars`);
    if (!desc) fail(`${p}: no meta description`);
    if (desc.length > DESC_MAX) fail(`${p}: description is ${desc.length} chars`);
  }
  return `${indexable.length} indexable pages`;
});

// ---- 4. Canonicals ---------------------------------------------------------------------

check("Canonicals use www.bnlch.com and match the page path", (fail) => {
  for (const p of indexable) {
    const c = html[p].match(/rel="canonical" href="([^"]+)"/)?.[1];
    if (p === "404.html") continue;
    if (!c) { fail(`${p}: no canonical`); continue; }
    const expected = `${SITE}/${p === "index.html" ? "" : p.replace(/\.html$/, "")}`;
    if (c !== expected) fail(`${p}: canonical ${c}, expected ${expected}`);
  }
});

// ---- 5. FAQ schema matches the page ------------------------------------------------------

const decode = faqText;

check("FAQPage schema only claims questions the page answers", (fail) => {
  let n = 0;
  for (const p of pages) {
    const blocks = [...html[p].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.flat().find((b) => b["@type"] === "FAQPage");
    if (!faq) continue;
    const onPage = new Map(
      [...html[p].matchAll(FAQ_ITEM_RE)].map(([, q, a]) => [decode(q), decode(a)]),
    );
    for (const q of faq.mainEntity) {
      n++;
      const name = decode(q.name);
      if (!onPage.has(name)) fail(`${p}: schema asks "${name}", which is not on the page`);
      else if (onPage.get(name) !== decode(q.acceptedAnswer.text)) fail(`${p}: schema answer for "${name}" differs from the page`);
    }
    if (onPage.size !== faq.mainEntity.length) fail(`${p}: ${onPage.size} questions on the page, ${faq.mainEntity.length} in schema`);
  }
  return `${n} schema questions`;
});

// ---- 6. Prices match the facts ----------------------------------------------------------

const guideModules = {};
if (exists("site/guides")) {
  for (const f of fs.readdirSync(path.join(root, "site/guides")).filter((f) => f.endsWith(".mjs"))) {
    const g = (await import(pathToFileURL(path.join(root, "site/guides", f)).href)).default;
    guideModules[`guides/${g.slug}.html`] = g;
  }
}

check("Every dollar figure is a tier price or a sourced figure", (fail) => {
  const tierFigures = TIERS.flatMap((t) => [t.monthly, t.total]);
  let n = 0;
  for (const p of indexable) {
    // The guides hub quotes each guide's lead, so it may use any guide's figures.
    const gs = p === "guides.html" ? Object.values(guideModules) : guideModules[p] ? [guideModules[p]] : [];
    const g = gs.length > 0;
    const allowed = new Set([...tierFigures, ...gs.flatMap((m) => [...m.sources.flatMap((s) => s.figures), ...(m.derivedFigures ?? [])])]);
    for (const [, amount] of text(html[p]).matchAll(/\$([\d,]+)/g)) {
      n++;
      const v = Number(amount.replace(/,/g, ""));
      if (!allowed.has(v)) fail(`${p}: $${amount} is not a tier price${g ? " or a sourced figure" : ""}`);
    }
  }
  return `${n} dollar figures`;
});

// ---- 7. Brand language ------------------------------------------------------------------

check("No never-write phrases", (fail) => {
  for (const p of [...pages, "llms.txt"]) {
    const t = (p === "llms.txt" ? read(p) : text(html[p])).toLowerCase();
    for (const phrase of NEVER_WRITE) if (t.includes(phrase)) fail(`${p}: "${phrase}"`);
  }
});

check("No credentials claimed for Elijah (none are on file)", (fail) => {
  for (const p of pages) {
    const m = text(html[p]).match(/Elijah[^.]{0,100}(certified|certification|CPT|licensed|registered dietitian|degree)/i);
    if (m) fail(`${p}: "${m[0].trim()}"`);
  }
});

// ---- 8. Sitemap and robots -----------------------------------------------------------------

check("Sitemap entries exist and cover every indexable page", (fail) => {
  const locs = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    if (!loc.startsWith(`${SITE}/`)) fail(`sitemap: ${loc} is not on ${SITE}`);
    else if (!resolves(loc.slice(SITE.length) || "/", "index.html")) fail(`sitemap: ${loc} does not resolve`);
  }
  for (const p of indexable) {
    if (p === "404.html") continue;
    const loc = `${SITE}/${p === "index.html" ? "" : p.replace(/\.html$/, "")}`;
    if (!locs.includes(loc)) fail(`sitemap: missing ${loc}`);
  }
  if (!read("robots.txt").includes(`Sitemap: ${SITE}/sitemap.xml`)) fail("robots.txt: Sitemap line does not point at the canonical host");
  return `${locs.length} URLs`;
});

// ---- 9. Shared chrome has not drifted ---------------------------------------------------------

check("Header and footer match site/chrome.mjs (build is current)", (fail) => {
  const norm = (s) => s.replace(/ aria-current="page"/g, "").replace(/href="\/assessment-start"[^>]*>Start My Free Assessment/g, "CTA").replace(/href="\/restart-assessment"([^>]*)>Take the Free Restart Assessment/g, "CTA");
  const h = norm(header()), f = norm(footer());
  for (const p of pages) {
    const ph = html[p].match(/<!-- ============ HEADER ============ -->[\s\S]*?<\/header>/)?.[0];
    const pf = html[p].match(/<!-- ============ FOOTER ============ -->[\s\S]*?<\/footer>/)?.[0];
    if (UTILITY_PAGES.has(p)) continue;
    if (norm(ph) !== h) fail(`${p}: header differs; run npm run generate`);
    if (!pf || norm(pf) !== f) fail(`${p}: footer differs; run npm run generate`);
  }
});

// ---- Report-only: dash density -------------------------------------------------------------------

check("Em dashes in prose (report only)", () => {
  const visible = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  const rows = indexable.map((p) => [p, (visible(html[p]).match(/—|&mdash;/g) ?? []).length]).filter(([, n]) => n);
  return rows.length ? rows.map(([p, n]) => `${p}: ${n}`).join(", ") : "none";
});

// ---- Output ------------------------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  const ok = r.problems.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.name}${r.info ? `  (${r.info})` : ""}`);
  for (const msg of r.problems) console.log(`        - ${msg}`);
}
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
