// Builds everything that is generated from site/:
//   - guides/<slug>.html and guides.html from site/guides/*.mjs
//   - the header and footer of every full-layout hand-written page
//   - sitemap.xml and the Guides section of llms.txt
//
// Run: npm run generate   (then npm run check before any deploy)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SITE } from "../site/facts.mjs";
import { header, footer, CTA_START } from "../site/chrome.mjs";
import { article, faqSchemaFromHtml } from "../site/article.mjs";
import { guidesHub } from "../site/hub.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (p) => path.relative(root, p);
const written = [];
const write = (file, content) => {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (fs.existsSync(full) && fs.readFileSync(full, "utf8") === content) return;
  fs.writeFileSync(full, content);
  written.push(file);
};

// ---- Guides ---------------------------------------------------------------------

const guideDir = path.join(root, "site/guides");
const guides = [];
for (const f of fs.readdirSync(guideDir).filter((f) => f.endsWith(".mjs")).sort()) {
  const g = (await import(pathToFileURL(path.join(guideDir, f)).href)).default;
  if (`${g.slug}.mjs` !== f) throw new Error(`${f}: slug "${g.slug}" must match the file name`);
  guides.push(g);
}
for (const g of guides) write(`guides/${g.slug}.html`, article(g));
write("guides.html", guidesHub(guides));

// Remove generated pages whose source was deleted.
for (const f of fs.readdirSync(path.join(root, "guides"))) {
  if (f.endsWith(".html") && !guides.some((g) => `${g.slug}.html` === f)) {
    fs.unlinkSync(path.join(root, "guides", f));
    written.push(`guides/${f} (removed)`);
  }
}

// ---- Shared chrome on hand-written pages -------------------------------------------

// Full-layout pages. The four funnel utility pages (404, assessment-start,
// seven-day-plan, payment) use a deliberately stripped header and are left alone.
const CHROME_PAGES = {
  "index.html": { active: "/" },
  "body-rebuild.html": { active: "/body-rebuild" },
  "tiers.html": { active: "/tiers" },
  "founder.html": { active: "/founder" },
  "restart-assessment.html": { active: "/restart-assessment", cta: CTA_START },
  "apply.html": { active: "/apply" },
  "faq.html": { active: "/faq" },
  "contact.html": { active: "/contact" },
  "policies.html": { active: "/policies" },
};

const HEADER_RE = /<!-- ============ HEADER ============ -->[\s\S]*?<\/header>/;
const FOOTER_RE = /<!-- ============ FOOTER ============ -->[\s\S]*?<\/footer>/;

for (const [file, opts] of Object.entries(CHROME_PAGES)) {
  let html = fs.readFileSync(path.join(root, file), "utf8");
  if (!HEADER_RE.test(html) || !FOOTER_RE.test(html)) throw new Error(`${file}: header or footer markers missing`);
  html = html.replace(HEADER_RE, () => header(opts)).replace(FOOTER_RE, () => footer(opts));
  write(file, syncFaqSchema(file, html));
}

// A hand-written page's FAQPage schema is regenerated from its own <details>,
// so the schema can never claim a question or answer the page does not show.
function syncFaqSchema(file, html) {
  return html.replace(/(<script type="application\/ld\+json">\n)([\s\S]*?)(\n<\/script>)/g, (whole, open, json, close) => {
    const data = JSON.parse(json);
    const list = Array.isArray(data) ? data : [data];
    const i = list.findIndex((b) => b["@type"] === "FAQPage");
    if (i === -1) return whole;
    const fresh = faqSchemaFromHtml(html);
    if (!fresh) throw new Error(`${file}: has FAQPage schema but no FAQ items on the page`);
    list[i] = fresh;
    return open + JSON.stringify(Array.isArray(data) ? list : list[0], null, 2) + close;
  });
}

// ---- sitemap.xml -------------------------------------------------------------------

const lastmod = (file) => {
  try {
    const d = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: root, encoding: "utf8" }).trim();
    if (d) return d;
  } catch {}
  return new Date().toISOString().slice(0, 10);
};

const SITEMAP = [
  ["/", "index.html", "weekly", "1.0"],
  ["/body-rebuild", "body-rebuild.html", "monthly", "0.9"],
  ["/tiers", "tiers.html", "monthly", "0.9"],
  ["/restart-assessment", "restart-assessment.html", "monthly", "0.9"],
  ["/founder", "founder.html", "monthly", "0.7"],
  ["/apply", "apply.html", "monthly", "0.8"],
  ["/faq", "faq.html", "monthly", "0.7"],
  ["/guides", "guides.html", "weekly", "0.7"],
  ...guides.map((g) => [`/guides/${g.slug}`, `guides/${g.slug}.html`, "monthly", "0.6", g.updated ?? g.published]),
  ["/contact", "contact.html", "yearly", "0.5"],
  ["/policies", "policies.html", "yearly", "0.3"],
];

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP.map(
  ([loc, file, freq, pri, date]) => `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${date ?? lastmod(file)}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`,
).join("\n")}
</urlset>
`,
);

// ---- llms.txt Guides section ----------------------------------------------------------

const llmsPath = path.join(root, "llms.txt");
const llms = fs.readFileSync(llmsPath, "utf8");
const START = "<!-- guides:start -->";
const END = "<!-- guides:end -->";
if (!llms.includes(START)) throw new Error(`llms.txt: missing ${START} marker`);
const section = `${START}
## Guides
${guides.map((g) => `- [${g.h1}](${SITE}/guides/${g.slug}): ${g.lead}`).join("\n")}
${END}`;
write("llms.txt", llms.replace(new RegExp(`${START}[\\s\\S]*?${END}`), section));

console.log(written.length ? `Updated:\n  ${written.join("\n  ")}` : "Nothing changed.");
