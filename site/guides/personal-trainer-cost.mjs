import { TIERS, PROGRAM, usd, word } from "../facts.mjs";
import { R_TIERS, R_ASSESSMENT, R_BODY_REBUILD } from "../related.mjs";

// Target terms (Semrush US, 2026-09-22): how much does a personal trainer cost
// 3,600/KD 17 · how much is a personal trainer 3,600/KD 24 · personal trainer
// cost 1,900/KD 22 · cost of a personal fitness trainer 1,600/KD 24.

const AVG = 55; // Thumbtack national average, per hour
const perWeeks = (sessions, weeks) => usd(AVG * sessions * weeks);

export default {
  slug: "personal-trainer-cost",
  title: "How Much Does a Personal Trainer Cost? (2026) | BNL Plus",
  description:
    "Most personal trainers charge $40 to $100 per session. See what drives the price, what it adds up to over a few months, and how online coaching compares.",
  eyebrow: "Cost and value",
  crumb: "Personal trainer cost",
  h1: "How much does a personal trainer cost?",
  lead:
    "Most in-person trainers charge $40 to $100 a session. Here is what drives that number, what it adds up to over a few months, and how online coaching is priced differently.",
  answer:
    "In-person personal training usually costs **$40 to $100 per session**, and the national average is about **$55 an hour**. Most people pay **$300 to $1,000 or more a month**, depending on how often they train. Online coaching is priced differently: you pay for the program and the feedback, not for an hour of someone's time.",
  published: "2026-09-22",

  blocks: [
    ["h2", "What one session costs"],
    ["p", "Thumbtack's national cost guide puts the typical range at $40 to $100 an hour, with an average of $55. Crunch Fitness gives a similar picture: most people pay $50 to $100 or more per session, and more for a very experienced trainer or a specialized setting."],
    ["p", "The range is wide because you are paying for a person's time, and that time is priced by where they work and what they bring to it."],

    ["h2", "What moves the price up or down"],
    ["list", [
      "**Experience and certifications.** Trainers with advanced credentials, or a focus like mobility or nutrition coaching, tend to charge more.",
      "**Where you live.** Sessions cost more in big cities, where demand and living costs are higher.",
      "**Where you train.** A private studio usually costs more than a trainer who works inside a gym.",
      "**Session length.** A 30-minute session costs less than a 60-minute one.",
      "**One-on-one or shared.** Group and semi-private sessions lower the price per person.",
      "**What happens between sessions.** Nutrition guidance and check-ins during the week add to the price.",
    ]],

    ["h2", "What it adds up to"],
    ["p", "A per-session price doesn't tell you much on its own. Strength and body composition change over months, not visits, so the number to plan around is what you will spend across the whole stretch."],
    ["table", {
      caption: `In-person training at the $${AVG} national average`,
      head: ["Sessions per week", "Four weeks", "Sixteen weeks"],
      rows: [
        ["One", perWeeks(1, 4), perWeeks(1, 16)],
        ["Two", perWeeks(2, 4), perWeeks(2, 16)],
        ["Three", perWeeks(3, 4), perWeeks(3, 16)],
      ],
      numeric: [1, 2],
    }],
    ["p", "Packages and local rates will move these numbers. Use them to plan for the months ahead, not just the first session."],

    ["h2", "How online coaching is priced"],
    ["p", "Online coaching usually isn't billed by the hour. You pay for a structured program and, depending on the level, for someone to review your progress and adjust the plan. Crunch lists online coaching as one of the ways people lower what they spend on training."],
    ["p", "The trade-off runs both ways. An in-person trainer can watch every rep and correct it on the spot. Online coaching can't do that live, but the structure keeps going between workouts, and you train on your own schedule, at home or in a gym."],
    ["p", "If you have never lifted and want someone beside you while you learn the movements, in-person sessions are worth paying for. If you know roughly what to do but keep stopping, the missing piece may be structure and accountability rather than supervision."],
    ["callout", {
      title: "What Body Rebuild costs",
      body: [`Body Rebuild is a ${PROGRAM.weeks}-week online program with three levels of support. Each level is ${word(TIERS[0].payments)} monthly payments.`],
      list: TIERS.map((t) => `**${t.short}: ${usd(t.monthly)} a month** (${usd(t.total)} total). ${t.summary}`),
      link: { href: "/tiers", label: "Compare the tiers in detail" },
    }],
    ["p", "You apply first. Nobody can buy a tier until their application has been reviewed and approved."],

    ["h2", "How to decide what to spend"],
    ["list", [
      "**Price the whole run, not the first month.** Pick an amount you can keep paying for at least a few months, so you aren't deciding all over again in week five.",
      "**Pay for what you are missing.** If you need hands-on instruction, pay for sessions. If you need a plan and someone checking your progress, pay for coaching.",
      "**Ask what happens between sessions.** Most of your week happens without the trainer. Find out whether you get a program, check-ins, or nothing until the next appointment.",
      "**Be careful with promises.** A trainer who guarantees a specific number of pounds is selling certainty nobody can give you.",
    ]],
    ["note", "Market prices come from Thumbtack's 2025 personal trainer cost guide and Crunch Fitness (June 2026). Rates in your area may differ. The four- and sixteen-week figures are our arithmetic at the $55 average. Body Rebuild prices are current as of September 2026."],

    ["faq", [
      ["How much does a personal trainer cost per session?", "Most in-person sessions cost $40 to $100, and the national average is about $55 an hour. Experienced trainers, big cities, and private studios sit at the top of that range."],
      ["How much does a personal trainer cost per month?", `Commonly $300 to $1,000 or more, depending on how many sessions you book. At the $${AVG} average, three sessions a week comes to about ${perWeeks(3, 4)} every four weeks.`],
      ["Is online personal training cheaper than in-person training?", "It often costs less per month, because you aren't paying for a trainer's hours. It is a different service, though: you get a program and remote feedback instead of live supervision. Which one is better value depends on what you need help with."],
      ["How much does Body Rebuild cost?", `${TIERS.map((t) => `${t.short} is ${usd(t.monthly)} a month`).join(", ").replace(/, ([^,]*)$/, ", and $1")}, each for ${word(TIERS[0].payments)} months. You apply first, and payment starts only after approval.`],
    ]],
  ],

  sources: [
    {
      name: "Thumbtack, Personal Trainer Cost",
      url: "https://www.thumbtack.com/p/personal-trainer-cost",
      detail: "2025 cost guide: $40 to $100 per hour nationally, $55 average.",
      accessed: "2026-09-22",
      figures: [40, 55, 100],
    },
    {
      name: "Crunch Fitness, Getting a Personal Trainer: Cost vs. Benefit",
      url: "https://www.crunch.com/thehub/how-much-does-a-personal-trainer-cost/",
      detail: "Carmine Ciliento, June 2026: $50 to $100 or more per session; $300 to $1,000 or more per month.",
      accessed: "2026-09-22",
      figures: [50, 100, 300, 1000],
    },
  ],
  // Figures computed on this page from the sourced $55 average.
  derivedFigures: [1, 2, 3].flatMap((n) => [AVG * n * 4, AVG * n * 16]),

  related: [R_TIERS, R_ASSESSMENT, R_BODY_REBUILD],
};
