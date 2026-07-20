# SEO / AEO — deployment notes for bnlch.com

Everything below is already built into the site files. These are the actions that can
only happen at (or after) deployment.

## Already done (in this repo)
- JSON-LD on all 9 indexable pages — validated:
  - Home: Organization + WebSite (entity recognition)
  - Body Rebuild: Service + BreadcrumbList
  - Compare Tiers: Service with OfferCatalog (3 tiers w/ prices) + BreadcrumbList
  - Founder: Person (Elijah Robles) + BreadcrumbList
  - FAQ: FAQPage (all 18 Q&As, matching visible text exactly) + BreadcrumbList
  - Assessment / Apply / Policies: WebPage + BreadcrumbList
  - Contact: ContactPage w/ ContactPoint + BreadcrumbList
- Canonical tags on all 9 pages pointing at the locked clean URLs (bnlch.com/body-rebuild etc.)
- Open Graph + Twitter card tags on all 9 pages
- robots.txt — explicitly allows GPTBot, ClaudeBot, PerplexityBot, GoogleOther, Bytespider,
  CCBot; disallows the two gated pages (assessment-start, seven-day-plan)
- sitemap.xml — 9 indexable URLs with priorities
- llms.txt — brand summary, key facts (program, tiers, prices, scope), page directory
- noindex on assessment-start.html and seven-day-plan.html (gated funnel pages, kept out
  of search so the lead magnet stays behind the assessment)

## At deployment
1. Map clean URLs: the canonicals use /body-rebuild, /tiers, /founder, /restart-assessment,
   /apply, /faq, /contact, /policies. Configure the host to serve each .html file at its
   clean path (most static hosts do this automatically or via one config line).
   Redirect www → root domain per the locked decisions.
2. HTTPS with a valid certificate (any modern host default).
3. Verify robots.txt, sitemap.xml, and llms.txt resolve at the domain root.

## After deployment (first week)
1. Google Search Console: verify the domain, submit sitemap.xml.
2. Bing Webmaster Tools: verify + submit sitemap (this is what feeds ChatGPT/Copilot).
3. Validate rich results: https://search.google.com/test/rich-results on / and /faq.
4. Validate OG cards: https://developers.facebook.com/tools/debug/ on the homepage.
5. When the [LEGAL ENTITY NAME] placeholder is resolved, add "legalName" to the
   Organization schema on index.html.
6. When client proof exists WITH signed permissions, consider adding Review /
   AggregateRating schema — do not add before real, permissioned reviews exist.

## AI visibility check (run ~4 weeks after deploy)
Ask in ChatGPT, Perplexity, Gemini, and Claude:
- "What is BNL Plus?"
- "Body Rebuild program review"
- "online fitness coaching for adults over 35"
Score: cited / influenced / absent — and iterate content accordingly.
