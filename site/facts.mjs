// Every fact the generated pages state lives here, once. The human-readable
// version with sources is Structure/facts.md (kept local). If a value is not
// in this file, generated pages do not say it.
//
// Hand-written pages still carry their own copy; scripts/check.mjs verifies
// their prices against TIERS so the two cannot drift apart.

export const SITE = "https://www.bnlch.com";

export const BRAND = {
  name: "BNL Plus",
  legalEntity: "BNL PLUS",
  endorsement: "A Bluffs Nutrition Lounge Brand",
  tagline: "Structured strength for real life.",
  email: "info@bnlch.com",
  serviceArea:
    "Online coaching available across the United States. Local Private sessions are available in the Scottsbluff, Nebraska area by appointment.",
  scope:
    "BNL Plus provides fitness and general nutrition coaching. It does not provide medical care, injury diagnosis, rehabilitation, physical therapy, medication management, or medical nutrition therapy.",
};

export const FOUNDER = {
  name: "Elijah Robles",
  title: "Founder and Coach",
};

export const SOCIALS = [
  { label: "Instagram", handle: "@22jusslijah", url: "https://www.instagram.com/22jusslijah" },
  { label: "TikTok", handle: "@elijahromanrobles", url: "https://www.tiktok.com/@elijahromanrobles" },
  { label: "Facebook", handle: "Elijah Robles", url: "https://www.facebook.com/profile.php?id=61587408270373" },
];

export const PROGRAM = {
  name: "Body Rebuild",
  weeks: 16,
  requiredWorkouts: 3,
};

export const TIERS = [
  {
    key: "essentials",
    name: "Body Rebuild Essentials",
    short: "Essentials",
    monthly: 149,
    payments: 4,
    total: 596,
    summary: "The full program and nutrition foundations, self-directed. No check-ins or coach access.",
  },
  {
    key: "coaching",
    name: "Body Rebuild Coaching",
    short: "Coaching",
    monthly: 229,
    payments: 4,
    total: 916,
    summary: "Weekly check-ins with written feedback, personalized starting nutrition targets, and a Sunday group call. Limited to 10 per group.",
  },
  {
    key: "private",
    name: "Body Rebuild Private",
    short: "Private",
    monthly: 499,
    payments: 4,
    total: 1996,
    summary: "Everything in Coaching plus a weekly 1:1 call, same-business-day weekday messaging, and one live session a month. Limited to five clients.",
  },
];

export const usd = (n) => "$" + n.toLocaleString("en-US");
export const word = (n) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);

// Phrases the brand never uses (client brand system, recap sheet v5).
export const NEVER_WRITE = [
  "slay demons",
  "dark side of greatness",
  "best version of yourself",
  "hunt hard",
  "master discipline",
  "become unstoppable",
  "built different",
  "legacy",
  "attack hard",
  "next gen",
];
