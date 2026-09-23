// Shared page chrome. The header and footer of every full-layout page come
// from here: scripts/build.mjs writes them into the hand-written pages and
// uses them for generated ones, so the nav cannot drift between pages.

import { BRAND, SOCIALS } from "./facts.mjs";

export const NAV = [
  { href: "/body-rebuild", label: "Body Rebuild" },
  { href: "/tiers", label: "Compare Tiers" },
  { href: "/founder", label: "Founder Story" },
  { href: "/faq", label: "FAQ" },
  { href: "/apply", label: "Apply" },
];

export const FOOTER_NAV = [
  { href: "/body-rebuild", label: "Body Rebuild" },
  { href: "/tiers", label: "Compare Tiers" },
  { href: "/founder", label: "Founder Story" },
  { href: "/restart-assessment", label: "Restart Assessment" },
  { href: "/apply", label: "Apply" },
  { href: "/faq", label: "FAQ" },
  { href: "/guides", label: "Guides" },
  { href: "/contact", label: "Contact" },
  { href: "/policies", label: "Policies" },
];

// The assessment landing page sends its own CTA straight into the tool.
export const CTA_DEFAULT = { href: "/restart-assessment", label: "Take the Free Restart Assessment" };
export const CTA_START = { href: "/assessment-start", label: "Start My Free Assessment" };

const current = (href, active) => (href === active ? ' aria-current="page"' : "");

export function header({ active = "", cta = CTA_DEFAULT } = {}) {
  const desktop = NAV.map((n) => `      <a class="navlink" href="${n.href}"${current(n.href, active)}>${n.label}</a>`).join("\n");
  const mobile = NAV.map((n, i) => {
    const cls = i === NAV.length - 1 ? "navlink py-2.5" : "navlink py-2.5 border-b border-mist";
    return `      <a class="${cls}" href="${n.href}"${current(n.href, active)}>${n.label}</a>`;
  }).join("\n");

  return `<!-- ============ HEADER ============ -->
<header class="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-line">
  <div class="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between h-16">
    <a href="/" class="flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-4" aria-label="BNL Plus home">
      <img src="/assets/logo-black.png" alt="BNL Plus" class="h-7 w-auto" />
    </a>
    <nav class="hidden lg:flex items-center gap-8" aria-label="Primary">
${desktop}
    </nav>
    <div class="hidden lg:block">
      <a href="${cta.href}" class="btn btn-primary !py-2.5 !px-5 text-sm">${cta.label}</a>
    </div>
    <button id="menu-btn" class="lg:hidden p-2 -mr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
      <svg id="icon-open" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M2 6h18M2 11h18M2 16h18" stroke="#000" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <svg id="icon-close" width="22" height="22" viewBox="0 0 22 22" fill="none" class="hidden" aria-hidden="true">
        <path d="M4 4l14 14M18 4L4 18" stroke="#000" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
  <div id="mobile-menu" class="hidden lg:hidden border-t border-line bg-white">
    <nav class="px-5 py-4 flex flex-col gap-1" aria-label="Mobile">
${mobile}
      <a href="${cta.href}" class="btn btn-primary mt-3 w-full">${cta.label}</a>
    </nav>
  </div>
</header>`;
}

export function footer({ active = "", cta = CTA_DEFAULT } = {}) {
  const links = FOOTER_NAV.map((n) => `        <a class="footlink" href="${n.href}"${current(n.href, active)}>${n.label}</a>`).join("\n");
  const socials = SOCIALS.map(
    (s) => `<a class="footlink" href="${s.url}" rel="noopener" target="_blank">${s.label}</a>`,
  ).join('\n          ');
  const year = new Date().getFullYear();

  return `<!-- ============ FOOTER ============ -->
<footer class="bg-white border-t border-line">
  <div class="max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-10">
    <div class="grid lg:grid-cols-12 gap-10">
      <div class="lg:col-span-5">
        <img src="/assets/logo-black.png" alt="BNL Plus" class="h-6 w-auto" />
        <p class="mt-5 font-display font-bold text-black text-lg">${BRAND.tagline}</p>
        <p class="mt-1 text-[0.85rem] text-stone">${BRAND.endorsement}</p>
        <p class="mt-6 text-[0.85rem] leading-relaxed text-stone max-w-sm">
          ${BRAND.serviceArea}
        </p>
        <nav class="mt-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Social profiles">
          ${socials}
        </nav>
      </div>
      <nav class="lg:col-span-4 grid grid-cols-2 gap-x-8 gap-y-3 content-start" aria-label="Footer">
${links}
      </nav>
      <div class="lg:col-span-3">
        <a href="${cta.href}" class="btn btn-primary w-full lg:w-auto">${cta.label}</a>
      </div>
    </div>

    <div class="mt-14 pt-8 border-t border-line">
      <p class="text-[0.78rem] leading-relaxed text-stone max-w-4xl">
        ${BRAND.scope}
      </p>
      <p class="mt-4 text-[0.78rem] text-stone">
        &copy; ${year} ${BRAND.legalEntity}. All rights reserved. ${BRAND.endorsement}.
      </p>
    </div>
  </div>
  <div class="overflow-hidden select-none" aria-hidden="true">
    <p class="font-display font-extrabold display-tight text-mist text-center whitespace-nowrap text-[19vw] leading-[0.78] translate-y-[12%]">BNL&nbsp;PLUS</p>
  </div>
</footer>`;
}

export const COHORT_BANNER = `<!-- ============ COHORT BANNER ============ -->
<div class="bg-black text-white text-center px-4 py-2.5">
  <p class="text-[0.78rem] font-medium tracking-wide" data-cohort="banner">
    Applications are open for the next Body Rebuild Coaching cohort. Limited to 10 participants.
  </p>
</div>`;

// <head> assets shared by generated pages. Tokens match the hand-written pages
// exactly (BNL Plus Brand System: monochrome, Archivo display, Inter body).
export const HEAD_ASSETS = `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
        colors: { ink: "#171717", graphite: "#333333", stone: "#767676", line: "#D7D7D4", mist: "#ECECEA", canvas: "#F7F7F5" },
        fontFamily: { display: ["Archivo", "Inter", "sans-serif"], body: ["Inter", "sans-serif"] },
      },
    },
  };
</script>`;

export const BASE_CSS = `
  html { scroll-behavior: smooth; }
  body { font-family: "Inter", sans-serif; }
  ::selection { background: #000; color: #fff; }
  .display-tight { letter-spacing: -0.03em; line-height: 0.98; }
  .eyebrow { font-weight: 600; font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
    font-weight: 600; font-size: 0.95rem; padding: 0.9rem 1.6rem;
    border-radius: 4px; border: 1px solid #000;
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
  }
  .btn:active { transform: translateY(1px); }
  .btn:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .btn-primary { background: #000; color: #fff; }
  .btn-primary:hover { background: #333333; border-color: #333333; }
  .btn-secondary { background: transparent; color: #000; }
  .btn-secondary:hover { background: #000; color: #fff; }
  .btn-invert { background: #fff; color: #000; border-color: #fff; }
  .btn-invert:hover { background: #ECECEA; border-color: #ECECEA; }
  .btn-invert:focus-visible { outline-color: #fff; }

  .navlink { font-size: 0.9rem; font-weight: 500; color: #333333; transition: color 0.15s ease; padding: 0.25rem 0; }
  .navlink:hover { color: #000; }
  .navlink:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
  .navlink[aria-current="page"] { color: #000; font-weight: 600; }

  .footlink { font-size: 0.85rem; color: #767676; transition: color 0.15s ease; }
  .footlink:hover { color: #000; }
  .footlink:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
  .footlink[aria-current="page"] { color: #000; }

  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
`;

export const SITE_SCRIPT = `<script>
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  menuBtn.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("hidden") === false;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.getElementById("icon-open").classList.toggle("hidden", open);
    document.getElementById("icon-close").classList.toggle("hidden", !open);
  });
</script>
<script defer src="/assets/cohort.js"></script>
<script defer src="/_vercel/insights/script.js"></script>`;
