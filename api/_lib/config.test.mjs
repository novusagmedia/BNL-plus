/**
 * Deployment config sanity.
 *
 * vercel.json is JSON, not JSONC — a `//` comment makes it unparseable, Vercel
 * fails the build, and the previous deployment keeps serving. The site stays
 * up, so nothing looks broken; the change simply never goes live. That failure
 * mode is quiet enough to waste a lot of time, hence this test.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("vercel.json is valid JSON", () => {
  const raw = read("vercel.json");

  assert.doesNotThrow(
    () => JSON.parse(raw),
    "vercel.json must parse — comments are not allowed in JSON",
  );
  assert.ok(!/^\s*\/\//m.test(raw), "vercel.json contains a // comment");
});

test("package.json is valid JSON", () => {
  assert.doesNotThrow(() => JSON.parse(read("package.json")));
});

test("vercel.json keeps the settings the deploy depends on", () => {
  const config = JSON.parse(read("vercel.json"));

  // Without this, Vercel installs puppeteer (and downloads Chrome) on deploy.
  assert.equal(config.installCommand, "npm install --omit=dev");

  // Every canonical tag and sitemap entry is extensionless; without cleanUrls
  // they all resolve to 404s.
  assert.equal(config.cleanUrls, true);

  // The result page the Day 0 email links to is served through this rewrite.
  const rewrite = (config.rewrites ?? []).find(
    (r) => r.source === "/restart-assessment/result",
  );
  assert.ok(rewrite, "missing the result-page rewrite");
  assert.equal(rewrite.destination, "/api/restart-assessment/result");
});

test("no page declares a canonical URL on the wrong host", () => {
  // The site 308s bnlch.com -> www.bnlch.com, so an apex canonical names a
  // redirect as its own authoritative URL.
  const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));

  for (const page of pages) {
    const html = read(page);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) continue;

    assert.ok(
      canonical.startsWith("https://www.bnlch.com"),
      `${page}: canonical points at ${canonical}`,
    );
    assert.ok(!canonical.endsWith(".html"), `${page}: canonical uses a .html path`);
  }
});

test("no page links to a .html path", () => {
  // cleanUrls would 308 these, costing a redirect on every internal click.
  const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));

  for (const page of pages) {
    const html = read(page);
    const bad = [...html.matchAll(/href="([^"]*\.html[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(bad, [], `${page} links to .html paths: ${bad.join(", ")}`);
  }
});
