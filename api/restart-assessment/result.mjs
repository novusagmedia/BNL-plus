/**
 * GET /restart-assessment/result?token=… — handoff §16.
 *
 * Server-rendered from the stored submission. The token identifies a
 * submission and nothing else (§16.1): every number and label on this page is
 * looked up server-side after the signature verifies, so the URL cannot be
 * edited to show a different result, and no personal data ever sits in a query
 * string (§9.4).
 *
 * Reached via a vercel.json rewrite so the visitor-facing URL is the one the
 * spec and the Day 0 email use, with no change to the rest of the site's URLs.
 *
 * The design deliberately mirrors the on-screen result in assessment-start.html
 * — same tokens, same components, same words. Someone who saw their result on
 * the site and then opens it from an email a week later must recognise it.
 */

import { createRepository } from "../_lib/repository.mjs";
import { verifyResultToken } from "../_lib/result-token.mjs";
import {
  CAT_DISPLAY,
  CAUTION_COPY,
  CONSTRAINT_COPY,
  LEVEL_COPY,
  READINESS_COPY,
  TIER_COPY,
  UNDER_18_COPY,
} from "../_lib/result-copy.mjs";

const PLAN_URL = () => process.env.SEVEN_DAY_PLAN_URL || "/seven-day-plan";

/** Escape everything interpolated into HTML. First names contain apostrophes. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="robots" content="noindex, nofollow" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          ink: "#171717", graphite: "#333333", stone: "#767676",
          line: "#D7D7D4", mist: "#ECECEA", canvas: "#F7F7F5",
        },
        fontFamily: {
          display: ["Archivo", "Inter", "sans-serif"],
          body: ["Inter", "sans-serif"],
        },
      },
    },
  };
</script>
<style>
  html { scroll-behavior: smooth; }
  body { font-family: "Inter", sans-serif; }
  ::selection { background: #000; color: #fff; }
  .display-tight { letter-spacing: -0.03em; line-height: 1.05; }
  .eyebrow { font-family: "Inter", sans-serif; font-weight: 600; font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; font-family: "Inter", sans-serif; font-weight: 600; font-size: 0.95rem; padding: 0.9rem 1.6rem; border-radius: 4px; border: 1px solid #000; transition: background-color 0.2s ease, color 0.2s ease, transform 0.15s ease; cursor: pointer; }
  .btn:active { transform: translateY(1px); }
  .btn:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .btn-primary { background: #000; color: #fff; }
  .btn-primary:hover { background: #333333; border-color: #333333; }
  .btn-secondary { background: transparent; color: #000; }
  .btn-secondary:hover { background: #000; color: #fff; }
  .navlink { font-size: 0.9rem; font-weight: 500; color: #333333; transition: color 0.15s ease; padding: 0.25rem 0; }
  .navlink:hover { color: #000; }
  .navlink:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .catbar-fill { transform-origin: left; transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
  @media (prefers-reduced-motion: reduce) {
    .catbar-fill { transition: none; }
    html { scroll-behavior: auto; }
  }
</style>
</head>
<body class="bg-canvas text-graphite antialiased min-h-screen flex flex-col">

<header class="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line">
  <div class="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between h-16">
    <a href="/" class="flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-4" aria-label="BNL Plus — Home">
      <img src="/assets/logo-black.png" alt="BNL Plus" class="h-7 w-auto" />
    </a>
    <p class="eyebrow text-stone hidden sm:block">Body Rebuild Restart Result</p>
    <a href="/" class="navlink">Home</a>
  </div>
</header>

<main id="main" class="flex-1">
${body}
</main>

<footer class="bg-white border-t border-line">
  <div class="max-w-7xl mx-auto px-5 md:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
    <p class="text-[0.78rem] text-stone">&copy; 2026 BNL Plus. All rights reserved. A Bluffs Nutrition Lounge Brand.</p>
    <p class="text-[0.78rem] text-stone max-w-md">BNL Plus provides fitness and general nutrition coaching. It does not provide medical care or medical nutrition therapy.</p>
  </div>
</footer>

<script defer src="/assets/cohort.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

function categoryBars(scores) {
  return Object.entries(CAT_DISPLAY)
    .map(([key, label]) => {
      const score = scores?.[key] ?? 0;
      return `<div>
        <div class="flex items-baseline justify-between gap-3 mb-1">
          <span class="text-[0.8rem] font-semibold text-ink">${esc(label)}</span>
          <span class="text-[0.8rem] text-stone">${score}/9</span>
        </div>
        <div class="h-[3px] bg-mist rounded-full overflow-hidden">
          <div class="catbar-fill h-full bg-black rounded-full" style="transform: scaleX(${score / 9})"></div>
        </div>
      </div>`;
    })
    .join("\n");
}

function renderResult(submission) {
  const { results, scores, firstName } = submission;

  const readiness = READINESS_COPY[results.readinessLabel] ?? READINESS_COPY.Rebuilding;
  const level = LEVEL_COPY[results.trainingLevel] ?? LEVEL_COPY.Build;
  const constraint = CONSTRAINT_COPY[results.biggestConstraint] ?? CONSTRAINT_COPY["Schedule Control"];
  const tier = TIER_COPY[results.likelySupportTier] ?? TIER_COPY.Coaching;

  const priceLine = `$${results.monthlyPrice}/month × 4 — $${Number(results.totalPrice).toLocaleString()} total`;

  // §3: under-18 keeps the result and the plan, loses only the paid CTA.
  const applyCta = results.under18
    ? ""
    : `<a href="/apply" class="btn btn-primary">Find My Best Body Rebuild Tier</a>`;

  const cautionBlock = results.painCaution
    ? `<p class="mt-6 text-[0.85rem] leading-[1.7] text-stone border border-line rounded-md p-5 bg-white">${esc(CAUTION_COPY)}</p>`
    : "";

  const under18Block = results.under18
    ? `<p class="mt-6 text-[0.85rem] leading-[1.7] text-stone border border-line rounded-md p-5 bg-white">${esc(UNDER_18_COPY)}</p>`
    : "";

  // Coaching only (§15.2). Rendered evergreen; cohort.js upgrades it to dated
  // copy while a cohort is current, so this can never show a passed deadline.
  const cohortBlock =
    results.likelySupportTier === "Coaching"
      ? `<p id="r-cohort" class="mt-4 text-[0.85rem] text-stone">Applications are open for the next Coaching cohort. Your start date is confirmed with you when you apply.</p>
         <script>
           document.addEventListener("DOMContentLoaded", function () {
             if (window.BNL_COHORT) {
               document.getElementById("r-cohort").textContent = window.BNL_COHORT.resultLine();
             }
           });
         </script>`
      : "";

  return layout({
    title: "Your Body Rebuild Restart Result | BNL Plus",
    body: `<div class="max-w-3xl mx-auto px-5 md:px-8 py-14 md:py-20">
  <p class="eyebrow text-stone mb-4">Your Body Rebuild Restart Result</p>
  <h1 class="font-display font-extrabold display-tight text-black text-3xl md:text-[2.6rem]">${esc(firstName)}, your result is ready.</h1>

  <div class="mt-10 border border-line bg-white rounded-md p-7 md:p-9">
    <div class="flex items-baseline justify-between gap-4 flex-wrap">
      <div>
        <p class="eyebrow text-stone mb-2">Your Result</p>
        <p class="font-display font-extrabold display-tight text-black text-3xl md:text-4xl">${esc(readiness.title)}</p>
      </div>
      <p class="font-display font-extrabold display-tight text-black text-3xl md:text-4xl">${scores.restartReadiness}<span class="text-stone text-xl font-bold">/45</span></p>
    </div>
    <p class="mt-5 text-[0.98rem] leading-[1.7] text-graphite">${esc(readiness.copy)}</p>
    <div class="mt-7 space-y-3">${categoryBars(scores)}</div>
  </div>

  <div class="mt-6 grid md:grid-cols-2 gap-6">
    <div class="border border-line bg-white rounded-md p-7">
      <p class="eyebrow text-stone mb-2">Likely Training Level</p>
      <p class="font-display font-extrabold display-tight text-black text-2xl">${esc(level.label)}</p>
      <p class="mt-3 text-[0.9rem] leading-[1.7] text-graphite">${esc(level.copy)}</p>
      <p class="mt-3 text-[0.85rem] font-semibold text-ink">${esc(results.programDisplay)}</p>
    </div>
    <div class="border border-line bg-white rounded-md p-7">
      <p class="eyebrow text-stone mb-2">Your Biggest Constraint</p>
      <p class="font-display font-extrabold display-tight text-black text-2xl">${esc(constraint.label)}</p>
      <p class="mt-3 text-[0.9rem] leading-[1.7] text-graphite">${esc(constraint.copy)}</p>
    </div>
  </div>

  <div class="mt-6 border-2 border-black bg-white rounded-md p-7 md:p-9">
    <p class="eyebrow text-stone mb-2">Your Likely Support Fit</p>
    <p class="font-display font-extrabold display-tight text-black text-2xl md:text-3xl">${esc(tier.name)}</p>
    <p class="mt-2 text-[0.95rem] font-semibold text-ink">${esc(priceLine)}</p>
    <p class="mt-4 text-[0.95rem] leading-[1.7] text-graphite">${esc(tier.sugg)}</p>
    <p class="mt-3 text-[0.95rem] leading-[1.7] text-graphite">${esc(tier.desc)}</p>
    ${cohortBlock}
  </div>

  ${cautionBlock}
  ${under18Block}

  <div class="mt-12 text-center">
    <h2 class="font-display font-extrabold display-tight text-black text-2xl md:text-3xl">Your assessment shows where you are now. Body Rebuild gives you the complete 16-week system.</h2>
    <p class="mt-4 text-[0.95rem] leading-[1.7] text-graphite max-w-xl mx-auto">Apply so BNL Plus can confirm your training level, accountability needs, and safest starting point.</p>
    <div class="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
      ${applyCta}
      <a href="${esc(PLAN_URL())}" class="btn btn-secondary">Download My Seven-Day Restart Plan</a>
    </div>
    <p class="mt-4 text-[0.85rem] text-stone">Not ready to apply? Begin with Day 1 today and use your results to guide the next seven days.</p>
  </div>
</div>`,
  });
}

/**
 * One page for every failure mode.
 *
 * §16.2 requires rejecting altered and expired tokens "without exposing whether
 * a particular email or submission exists" — so a forged token and a genuinely
 * expired one produce identical output. The only concession is the retake path,
 * which is useful to everybody and reveals nothing.
 */
function renderUnavailable() {
  return layout({
    title: "This result link is no longer available | BNL Plus",
    body: `<div class="max-w-xl mx-auto px-5 md:px-8 py-20 md:py-28">
  <p class="eyebrow text-stone mb-4">Result Link</p>
  <h1 class="font-display font-extrabold display-tight text-black text-3xl md:text-4xl">This result link is no longer available.</h1>
  <p class="mt-6 text-[0.98rem] leading-[1.7] text-graphite">Result links expire for privacy. Taking the assessment again takes about four minutes and gives you a current result — your answers may have changed since last time anyway.</p>
  <div class="mt-8 flex flex-col sm:flex-row gap-3">
    <a href="/assessment-start" class="btn btn-primary">Take the Assessment Again</a>
    <a href="/contact" class="btn btn-secondary">Contact BNL Plus</a>
  </div>
</div>`,
  });
}

export default async function handler(req, res) {
  // Personal data: never cached by a browser, proxy, or CDN.
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    return res.end(renderUnavailable());
  }

  const url = new URL(req.url, `https://${req.headers.host || "www.bnlch.com"}`);
  const token = url.searchParams.get("token");

  const verified = verifyResultToken(token);
  if (!verified.ok) {
    res.statusCode = verified.reason === "expired" ? 410 : 404;
    return res.end(renderUnavailable());
  }

  let submission;
  try {
    submission = await createRepository().findById(verified.submissionId);
  } catch (error) {
    console.error(
      JSON.stringify({ scope: "restart-assessment.result", at: "findById", code: error.code }),
    );
    res.statusCode = 503;
    return res.end(renderUnavailable());
  }

  if (!submission) {
    res.statusCode = 404;
    return res.end(renderUnavailable());
  }

  res.statusCode = 200;
  return res.end(renderResult(submission));
}

export { renderResult, renderUnavailable };
