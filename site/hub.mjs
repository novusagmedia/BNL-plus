// The /guides index page. Lists every guide, newest first.

import { SITE, BRAND } from "./facts.mjs";
import { esc, trimDescription } from "./article.mjs";
import { header, footer, COHORT_BANNER, HEAD_ASSETS, BASE_CSS, SITE_SCRIPT } from "./chrome.mjs";

export function guidesHub(guides) {
  const title = "Guides for Restarting Strength Training | BNL Plus";
  const description = trimDescription(
    "Straight answers for busy adults 35+ getting back into training: what coaching costs, how to restart, and what to expect. Written by Elijah Robles.",
  );
  const url = `${SITE}/guides`;
  const sorted = [...guides].sort((a, b) => (b.updated ?? b.published).localeCompare(a.updated ?? a.published));

  const items = sorted
    .map(
      (g) => `      <li>
        <a class="hub-item" href="/guides/${g.slug}">
          <span class="eyebrow text-stone">${esc(g.eyebrow)}</span>
          <span class="hub-title">${esc(g.h1)}</span>
          <span class="hub-lead">${esc(g.lead)}</span>
          <span class="hub-arrow" aria-hidden="true">Read the guide &rarr;</span>
        </a>
      </li>`,
    )
    .join("\n");

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "BNL Plus Guides",
      url,
      description,
      publisher: { "@type": "Organization", name: BRAND.name, url: `${SITE}/` },
      hasPart: sorted.map((g) => ({ "@type": "Article", headline: g.h1, url: `${SITE}/guides/${g.slug}` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: url },
      ],
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${BRAND.name}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/assets/band-brand.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
${HEAD_ASSETS}
<style>${BASE_CSS}${HUB_CSS}</style>
</head>

<body class="bg-white text-graphite antialiased">

${COHORT_BANNER}

${header({ active: "/guides" })}

<main id="main">

<section class="bg-canvas border-b border-line" aria-labelledby="hero-heading">
  <div class="max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-16 md:pt-20 md:pb-20">
    <p class="eyebrow text-stone mb-6">Guides</p>
    <h1 id="hero-heading" class="font-display font-extrabold display-tight text-black text-4xl sm:text-5xl lg:text-[4.2rem] max-w-4xl">Straight answers for getting back into training.</h1>
    <p class="mt-7 max-w-xl text-[1.05rem] leading-[1.7] text-graphite">What coaching costs, how to restart without starting over again, and what to expect along the way. Written by Elijah Robles for busy adults 35+.</p>
  </div>
</section>

<section aria-label="All guides">
  <div class="max-w-7xl mx-auto px-5 md:px-8 py-16 md:py-20">
    <ul class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
${items}
    </ul>
  </div>
</section>

</main>

${footer({ active: "/guides" })}

${SITE_SCRIPT}
</body>
</html>
`;
}

const HUB_CSS = `
  .hub-item {
    position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.7rem; background: #fff; border: 1px solid #D7D7D4; border-top: 4px solid #000; padding: 1.75rem 1.5rem 1.6rem;
    transition: border-color 0.2s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease;
  }
  .hub-item:hover { border-color: #000; transform: translateY(-2px); box-shadow: 0 14px 30px -18px rgba(23,23,23,0.35); }
  .hub-item:active { transform: translateY(0); }
  .hub-item:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .hub-title { font-family: "Archivo", sans-serif; font-weight: 800; color: #000; font-size: 1.45rem; line-height: 1.15; letter-spacing: -0.02em; }
  .hub-lead { font-size: 0.95rem; line-height: 1.65; color: #333333; }
  .hub-arrow { margin-top: auto; padding-top: 0.75rem; font-size: 0.9rem; font-weight: 600; color: #000; }
  @media (prefers-reduced-motion: reduce) { .hub-item { transition: none; } .hub-item:hover { transform: none; } }
`;
