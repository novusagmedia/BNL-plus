// article(): turns a guide written as typed blocks into a finished page.
//
// Guides are data, never markup. The renderer owns every tag, so spacing,
// heading levels, the byline, sources, the closing CTA, and schema are
// identical on every guide and cannot be forgotten on one of them.
//
// Block vocabulary (keep it small):
//   ["h2", text]
//   ["p", text]
//   ["list", [text, ...]]
//   ["callout", { title, body?: [text], list?: [text], link?: {href, label} }]
//   ["table", { caption, head: [..], rows: [[..], ..], numeric?: [colIndex] }]
//   ["note", text]
//   ["faq", [[question, answer], ...]]
//
// Inline text supports **bold** and [label](/href). Everything else is escaped.

import { SITE, BRAND, FOUNDER } from "./facts.mjs";
import { header, footer, COHORT_BANNER, HEAD_ASSETS, BASE_CSS, SITE_SCRIPT } from "./chrome.mjs";

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, label, href) => {
      const external = /^https?:/.test(href);
      const attrs = external ? ' rel="noopener" target="_blank"' : "";
      return `<a class="prose-link" href="${href}"${attrs}>${label}</a>`;
    });
}

const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[(.+?)\]\((.+?)\)/g, "$1");

// ---- Build-time guards -------------------------------------------------------

export const TITLE_MAX = 65;
export const DESC_MAX = 158;

// Trim a description to whole sentences under DESC_MAX, so the limit cannot
// silently regress when copy is edited later.
export function trimDescription(desc) {
  if (desc.length <= DESC_MAX) return desc;
  const sentences = desc.match(/[^.!?]+[.!?]+/g) ?? [desc];
  let out = "";
  for (const s of sentences) {
    const next = (out + s).trim();
    if (next.length > DESC_MAX) break;
    out = next + " ";
  }
  out = out.trim();
  if (!out) throw new Error(`Description's first sentence exceeds ${DESC_MAX} chars: "${desc}"`);
  return out;
}

// ---- Blocks ---------------------------------------------------------------------

function renderBlocks(blocks) {
  const out = [];
  blocks.forEach(([type, data], i) => {
    // A callout heading is h2 when it opens the article and h3 inside a
    // section, so the outline never skips a level.
    const calloutLevel = i === 0 ? "h2" : "h3";
    switch (type) {
      case "h2": {
        const id = slugify(data);
        out.push(`<h2 id="${id}" class="g-h2">${inline(data)}</h2>`);
        break;
      }
      case "p":
        out.push(`<p class="g-p">${inline(data)}</p>`);
        break;
      case "list":
        out.push(`<ul class="g-list">\n${data.map((li) => `  <li>${inline(li)}</li>`).join("\n")}\n</ul>`);
        break;
      case "callout": {
        const body = (data.body ?? []).map((p) => `  <p>${inline(p)}</p>`).join("\n");
        const list = data.list ? `  <ul class="g-list">\n${data.list.map((li) => `    <li>${inline(li)}</li>`).join("\n")}\n  </ul>` : "";
        const link = data.link ? `  <p class="g-callout-link"><a class="prose-link" href="${data.link.href}">${esc(data.link.label)}</a></p>` : "";
        out.push(`<aside class="g-callout">\n  <${calloutLevel} class="g-callout-title">${inline(data.title)}</${calloutLevel}>\n${[body, list, link].filter(Boolean).join("\n")}\n</aside>`);
        break;
      }
      case "table": {
        const num = new Set(data.numeric ?? []);
        const th = data.head.map((h, c) => `<th scope="col"${num.has(c) ? ' class="num"' : ""}>${inline(h)}</th>`).join("");
        const rows = data.rows
          .map((r) => `    <tr>${r.map((cell, c) => (c === 0 ? `<th scope="row">${inline(cell)}</th>` : `<td${num.has(c) ? ' class="num"' : ""}>${inline(cell)}</td>`)).join("")}</tr>`)
          .join("\n");
        out.push(`<div class="g-table-wrap">\n<table class="g-table">\n  <caption>${inline(data.caption)}</caption>\n  <thead><tr>${th}</tr></thead>\n  <tbody>\n${rows}\n  </tbody>\n</table>\n</div>`);
        break;
      }
      case "note":
        out.push(`<p class="g-note">${inline(data)}</p>`);
        break;
      case "faq": {
        const items = data
          .map(([q, a]) => `  <details class="faq-item">\n    <summary>${inline(q)}<span class="faq-icon" aria-hidden="true">+</span></summary>\n    <p class="faq-a">${inline(a)}</p>\n  </details>`)
          .join("\n");
        out.push(`<h2 id="common-questions" class="g-h2">Common questions</h2>\n<div class="g-faq">\n${items}\n</div>`);
        break;
      }
      default:
        throw new Error(`Unknown block type "${type}"`);
    }
  });
  return out.join("\n\n");
}

export const slugify = (s) =>
  plain(s).toLowerCase().replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// FAQPage schema is parsed from the page's own rendered <details>, never from
// a parallel list, so it cannot claim a question the page does not answer.
const ENTITIES = { amp: "&", quot: '"', "#39": "'", apos: "'", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", ndash: "\u2013", mdash: "\u2014", nbsp: " ", times: "\u00d7", middot: "\u00b7", rarr: "\u2192" };

// Visible text of an FAQ question or answer, as a reader would see it.
export const faqText = (s) =>
  s.replace(/<span class="faq-icon"[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, "")
    .replace(/&([a-z]+|#39);/g, (m, e) => ENTITIES[e] ?? m).replace(/\s+/g, " ").trim();

export const FAQ_ITEM_RE = /<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<p class="faq-a"[^>]*>([\s\S]*?)<\/p>/g;

export function faqSchemaFromHtml(html) {
  const strip = faqText;
  const items = [...html.matchAll(FAQ_ITEM_RE)];
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([, q, a]) => ({
      "@type": "Question",
      name: strip(q),
      acceptedAnswer: { "@type": "Answer", text: strip(a) },
    })),
  };
}

// ---- Page ------------------------------------------------------------------------

const readingMinutes = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 230));

const fmtDate = (iso) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function article(g) {
  for (const k of ["slug", "title", "description", "eyebrow", "crumb", "h1", "lead", "answer", "blocks", "related", "published", "sources"]) {
    if (g[k] === undefined) throw new Error(`${g.slug ?? "guide"}: missing "${k}"`);
  }
  if (g.title.length > TITLE_MAX) throw new Error(`${g.slug}: title is ${g.title.length} chars (max ${TITLE_MAX})`);

  const url = `${SITE}/guides/${g.slug}`;
  const description = trimDescription(g.description);
  const updated = g.updated ?? g.published;
  const body = renderBlocks(g.blocks);
  const words = plain(g.lead + " " + g.answer + " " + JSON.stringify(g.blocks));
  const minutes = readingMinutes(words);

  const sources = g.sources.length
    ? `<section class="g-sources" aria-labelledby="sources-heading">
  <h2 id="sources-heading" class="g-sources-title">Sources</h2>
  <ol>
${g.sources.map((s) => `    <li><a class="prose-link" href="${s.url}" rel="noopener" target="_blank">${esc(s.name)}</a>. ${esc(s.detail)} Accessed ${fmtDate(s.accessed)}.</li>`).join("\n")}
  </ol>
</section>`
    : "";

  const related = g.related
    .map(
      (r) => `      <a class="g-related" href="${r.href}">
        <span class="eyebrow text-stone">${esc(r.kind)}</span>
        <span class="g-related-title">${esc(r.title)}</span>
        <span class="g-related-blurb">${esc(r.blurb)}</span>
        <span class="g-related-arrow" aria-hidden="true">&rarr;</span>
      </a>`,
    )
    .join("\n");

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.h1,
      description,
      datePublished: g.published,
      dateModified: updated,
      mainEntityOfPage: url,
      author: { "@type": "Person", name: FOUNDER.name, jobTitle: FOUNDER.title, url: `${SITE}/founder` },
      publisher: { "@type": "Organization", name: BRAND.name, url: `${SITE}/`, logo: { "@type": "ImageObject", url: `${SITE}/assets/logo-black.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
        { "@type": "ListItem", position: 3, name: g.crumb, item: url },
      ],
    },
  ];
  const faq = faqSchemaFromHtml(body);
  if (faq) schema.push(faq);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${BRAND.name}" />
<meta property="og:title" content="${esc(g.title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/assets/band-brand.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta property="article:published_time" content="${g.published}" />
<meta property="article:modified_time" content="${updated}" />
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
${HEAD_ASSETS}
<style>${BASE_CSS}${GUIDE_CSS}</style>
</head>

<body class="bg-white text-graphite antialiased">

${COHORT_BANNER}

${header({ active: "/guides" })}

<main id="main">

<!-- ============ HERO ============ -->
<section class="bg-canvas border-b border-line" aria-labelledby="hero-heading">
  <div class="max-w-3xl mx-auto px-5 md:px-8 pt-12 pb-14 md:pt-16 md:pb-16">
    <nav aria-label="Breadcrumb" class="g-crumbs">
      <a href="/">Home</a><span aria-hidden="true">/</span><a href="/guides">Guides</a><span aria-hidden="true">/</span><span aria-current="page">${esc(g.crumb)}</span>
    </nav>
    <p class="eyebrow text-stone mt-10 mb-5">${esc(g.eyebrow)}</p>
    <h1 id="hero-heading" class="font-display font-extrabold display-tight text-black text-[2.4rem] sm:text-5xl lg:text-[3.6rem]">${inline(g.h1)}</h1>
    <p class="mt-6 text-[1.1rem] leading-[1.7] text-graphite">${inline(g.lead)}</p>
    <p class="g-byline mt-8"><span>By <a href="/founder">${FOUNDER.name}</a>, ${FOUNDER.title}</span><span class="g-dot" aria-hidden="true">&middot;</span><span>Updated <time datetime="${updated}">${fmtDate(updated)}</time></span><span class="g-dot" aria-hidden="true">&middot;</span><span>${minutes} min read</span></p>
  </div>
</section>

<!-- ============ SHORT ANSWER ============ -->
<div class="max-w-3xl mx-auto px-5 md:px-8">
  <section class="g-answer" aria-labelledby="answer-heading">
    <h2 id="answer-heading" class="eyebrow">The short answer</h2>
    <p>${inline(g.answer)}</p>
  </section>
</div>

<!-- ============ BODY ============ -->
<article class="max-w-3xl mx-auto px-5 md:px-8 pb-20 g-body">
${body}

${sources}
</article>

<!-- ============ CTA (black) ============ -->
<section class="bg-black text-white" aria-labelledby="cta-heading">
  <div class="max-w-3xl mx-auto px-5 md:px-8 py-20 md:py-24">
    <p class="eyebrow text-[#9a9a9a] mb-5">Free, about five minutes</p>
    <h2 id="cta-heading" class="font-display font-extrabold display-tight text-white text-4xl md:text-5xl">Find out what level of support you actually need.</h2>
    <p class="mt-6 text-[1.05rem] leading-[1.7] text-[#cfcfcf] max-w-xl">The Restart Assessment scores your consistency, strength confidence, nutrition, recovery, schedule, and accountability, then shows your likely training level and support tier.</p>
    <div class="mt-9 flex flex-col sm:flex-row gap-3">
      <a href="/restart-assessment" class="btn btn-invert">Take the Free Restart Assessment</a>
      <a href="/tiers" class="btn g-btn-ghost">Compare Body Rebuild Tiers</a>
    </div>
  </div>
</section>

<!-- ============ RELATED ============ -->
<section class="bg-canvas border-b border-line" aria-labelledby="related-heading">
  <div class="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
    <h2 id="related-heading" class="font-display font-bold display-tight text-black text-2xl md:text-3xl">Keep reading</h2>
    <div class="mt-8 grid gap-4 md:grid-cols-3">
${related}
    </div>
  </div>
</section>

</main>

${footer({ active: "/guides" })}

${SITE_SCRIPT}
</body>
</html>
`;
}

// ---- Guide styles ----------------------------------------------------------------

export const GUIDE_CSS = `
  .g-crumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: #767676; }
  .g-crumbs a { color: #333333; text-decoration: underline; text-decoration-color: #D7D7D4; text-underline-offset: 3px; transition: color 0.15s ease, text-decoration-color 0.15s ease; }
  .g-crumbs a:hover { color: #000; text-decoration-color: #000; }
  .g-crumbs a:focus-visible { outline: 2px solid #000; outline-offset: 2px; }

  .g-byline { font-size: 0.85rem; line-height: 1.8; color: #767676; }
  .g-byline > span { display: inline-block; white-space: nowrap; }
  .g-dot { margin: 0 0.6rem; }
  .g-byline a { color: #171717; font-weight: 600; text-decoration: underline; text-decoration-color: #D7D7D4; text-underline-offset: 3px; }
  .g-byline a:hover { text-decoration-color: #000; }
  .g-byline a:focus-visible { outline: 2px solid #000; outline-offset: 2px; }

  /* The one bold element: the answer, set large, lifted over the hero edge. */
  .g-answer {
    position: relative; margin-top: -2rem; background: #fff; border: 1px solid #D7D7D4; border-top: 4px solid #000;
    padding: 1.75rem 1.5rem 1.9rem; box-shadow: 0 1px 2px rgba(23,23,23,0.04), 0 12px 32px -12px rgba(23,23,23,0.14);
  }
  .g-answer h2 { color: #767676; margin-bottom: 0.9rem; }
  .g-answer p { font-size: 1.15rem; line-height: 1.6; color: #333333; }
  .g-answer strong { font-family: "Archivo", sans-serif; font-weight: 800; color: #000; letter-spacing: -0.01em; }
  @media (min-width: 768px) { .g-answer { padding: 2.25rem 2.5rem 2.4rem; } .g-answer p { font-size: 1.32rem; } }

  .g-body { padding-top: 1rem; }
  .g-h2 { font-family: "Archivo", sans-serif; font-weight: 800; color: #000; font-size: 1.7rem; line-height: 1.15; letter-spacing: -0.02em; margin-top: 3.5rem; margin-bottom: 1rem; scroll-margin-top: 6rem; }
  @media (min-width: 768px) { .g-h2 { font-size: 2rem; } }
  .g-p { font-size: 1.06rem; line-height: 1.75; color: #333333; margin-top: 1.1rem; max-width: 68ch; }
  .g-p strong, .g-list strong, .g-callout strong { color: #000; font-weight: 600; }

  .g-list { margin-top: 1.1rem; display: grid; gap: 0.7rem; max-width: 68ch; }
  .g-list li { position: relative; padding-left: 1.4rem; font-size: 1.03rem; line-height: 1.7; color: #333333; }
  .g-list li::before { content: ""; position: absolute; left: 0; top: 0.72em; width: 6px; height: 6px; background: #000; }

  .prose-link { color: #000; font-weight: 500; text-decoration: underline; text-decoration-color: #767676; text-underline-offset: 3px; transition: text-decoration-color 0.15s ease; }
  .prose-link:hover { text-decoration-color: #000; }
  .prose-link:focus-visible { outline: 2px solid #000; outline-offset: 2px; }

  .g-callout { margin-top: 2.5rem; background: #F7F7F5; border: 1px solid #D7D7D4; padding: 1.75rem 1.5rem; }
  @media (min-width: 768px) { .g-callout { padding: 2rem 2.25rem; } }
  .g-callout-title { font-family: "Archivo", sans-serif; font-weight: 800; color: #000; font-size: 1.3rem; line-height: 1.2; letter-spacing: -0.015em; }
  .g-callout p { margin-top: 0.85rem; font-size: 1rem; line-height: 1.7; color: #333333; }
  .g-callout .g-list { margin-top: 1rem; }
  .g-callout-link { margin-top: 1.25rem !important; }

  .g-table-wrap { margin-top: 1.75rem; overflow-x: auto; }
  .g-table { width: 100%; border-collapse: collapse; font-size: 0.98rem; }
  .g-table caption { text-align: left; font-size: 0.8rem; color: #767676; padding-bottom: 0.75rem; }
  .g-table th, .g-table td { text-align: left; padding: 0.85rem 1rem 0.85rem 0; border-bottom: 1px solid #D7D7D4; vertical-align: top; }
  .g-table thead th { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #767676; border-bottom-color: #000; }
  .g-table tbody th { font-weight: 600; color: #171717; }
  .g-table td { color: #333333; }
  .g-table .num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; }
  .g-table td.num { font-family: "Archivo", sans-serif; font-weight: 700; color: #000; }

  .g-note { margin-top: 1.75rem; padding-top: 1rem; border-top: 1px solid #D7D7D4; font-size: 0.85rem; line-height: 1.65; color: #767676; max-width: 68ch; }

  .g-faq { margin-top: 0.5rem; border-top: 1px solid #D7D7D4; }
  .faq-item { border-bottom: 1px solid #D7D7D4; }
  .faq-item summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: baseline; gap: 1.25rem; padding: 1.3rem 0; font-weight: 600; color: #171717; font-size: 1rem; }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary:hover { color: #000; }
  .faq-item summary:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .faq-icon { flex-shrink: 0; font-family: "Archivo", sans-serif; font-weight: 700; font-size: 1.25rem; line-height: 1; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
  .faq-item[open] .faq-icon { transform: rotate(45deg); }
  .faq-a { padding: 0 0 1.3rem; color: #333333; font-size: 0.97rem; line-height: 1.7; max-width: 65ch; }

  .g-sources { margin-top: 3.5rem; padding-top: 1.5rem; border-top: 1px solid #D7D7D4; }
  .g-sources-title { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #767676; }
  .g-sources ol { margin-top: 0.9rem; padding-left: 1.2rem; list-style: decimal; display: grid; gap: 0.5rem; }
  .g-sources li { font-size: 0.85rem; line-height: 1.6; color: #767676; }

  .g-btn-ghost { background: transparent; color: #fff; border-color: #fff; }
  .g-btn-ghost:hover { background: #fff; color: #000; }
  .g-btn-ghost:focus-visible { outline-color: #fff; }

  .g-related {
    position: relative; display: flex; flex-direction: column; gap: 0.6rem; background: #fff; border: 1px solid #D7D7D4; padding: 1.5rem 1.5rem 3rem;
    transition: border-color 0.2s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease;
  }
  .g-related:hover { border-color: #000; transform: translateY(-2px); box-shadow: 0 14px 30px -18px rgba(23,23,23,0.35); }
  .g-related:active { transform: translateY(0); }
  .g-related:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .g-related-title { font-family: "Archivo", sans-serif; font-weight: 800; color: #000; font-size: 1.2rem; line-height: 1.2; letter-spacing: -0.015em; }
  .g-related-blurb { font-size: 0.92rem; line-height: 1.6; color: #333333; }
  .g-related-arrow { position: absolute; left: 1.5rem; bottom: 1.2rem; font-weight: 600; color: #000; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }
  .g-related:hover .g-related-arrow { transform: translateX(4px); }

  @media (prefers-reduced-motion: reduce) {
    .faq-icon, .g-related, .g-related-arrow { transition: none; }
    .g-related:hover, .g-related:hover .g-related-arrow { transform: none; }
  }
`;
