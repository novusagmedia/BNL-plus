import { PROGRAM } from "../facts.mjs";
import { R_BODY_REBUILD, R_ASSESSMENT, G_RESTART } from "../related.mjs";

// Target terms (Semrush US, 2026-09-22): body recomposition workout plan
// 1,000/KD 16 · body recomposition plan 320/KD 22 · body recomposition
// workout 320/KD 16 · how long does body recomposition take 880/KD 29.

const BARAKAT = "https://www.ovid.com/jnls/nsca-scj/fulltext/10.1519/ssc.0000000000000584~body-recomposition-can-trained-individuals-build-muscle-and";
const ISSN = "https://pubmed.ncbi.nlm.nih.gov/28642676/";
const CDC = "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html";

export default {
  slug: "body-recomposition-workout-plan",
  title: "Body Recomposition Workout Plan (Sample Week) | BNL Plus",
  description:
    "Body recomposition means losing fat and building muscle at the same time. Here is what drives it, a sample three-day week, and how to track it honestly.",
  eyebrow: "Training",
  crumb: "Body recomposition plan",
  h1: "A body recomposition workout plan",
  lead:
    "Losing fat and building muscle at the same time is possible, and it is most noticeable in people who are new to lifting or coming back after a break. Here is what drives it and what a week can look like.",
  answer:
    "Body recomposition means **losing fat and building muscle at the same time**. It is driven by two things: **progressive strength training** and **enough protein**, with a calorie intake you can sustain. Three full-body sessions a week is a practical plan. It shows up most clearly in beginners and people returning after time off, and results vary a lot from person to person.",
  published: "2026-09-22",

  blocks: [
    ["h2", "What body recomposition is"],
    ["p", "Recomposition is the name coaches use for gaining muscle and losing fat over the same period. A 2020 review in the Strength and Conditioning Journal by Barakat and colleagues describes it this way and points to two main drivers: progressive resistance training and evidence-based nutrition."],
    ["p", "Because you are adding muscle while losing fat, your body weight can change slowly even while your measurements, strength, and photos improve. That is why the scale alone is a poor scoreboard for a recomposition."],

    ["h2", "Who it works best for"],
    ["p", "The same review notes that recomposition has long been associated with people who are new to training or carrying more body fat, and that it has also been shown in trained lifters. Two points matter if you are restarting:"],
    ["list", [
      "**Beginners tend to adapt faster.** Training history affects how quickly muscle is gained, and novices usually see bigger early changes than experienced lifters.",
      "**Returning lifters tend to regain quickly.** The review describes athletes who took time off and then regained their body composition quickly once they started training again.",
      "**Individual results vary widely.** In one study the review covers, some participants gained several kilograms of lean mass while losing fat, and others went the opposite direction on the same plan.",
    ]],

    ["h2", "A sample week"],
    ["p", `This is a general template, not a personal program. It follows the same shape as Body Rebuild: ${PROGRAM.requiredWorkouts} required strength sessions, walking on the days between, and an optional fourth session only when recovery allows.`],
    ["table", {
      caption: "A three-day full-body recomposition week",
      head: ["Day", "Session", "What it covers"],
      rows: [
        ["Monday", "Strength A", "Squat pattern, horizontal push, horizontal pull, core"],
        ["Tuesday", "Walk", "About 30 minutes at an easy, conversational pace"],
        ["Wednesday", "Strength B", "Hip hinge, vertical push, vertical pull, loaded carry"],
        ["Thursday", "Walk or rest", "Keep it easy"],
        ["Friday", "Strength A", "Same exercises as Monday; try to beat Monday's reps"],
        ["Weekend", "Optional fourth session", "Only if sleep, soreness, and schedule allow"],
      ],
    }],
    ["p", "Three full-body sessions train the major muscle groups three times a week, which meets the CDC's guideline of muscle-strengthening work on at least two days. The walks add toward its 150 minutes of weekly moderate activity."],

    ["h2", "How to progress it"],
    ["list", [
      "**Add reps before weight.** Work within a rep range, and add load only once you reach the top of it on every set.",
      "**Leave one to three reps in reserve on most working sets.** Hard enough to drive progress, easy enough to recover for the next session.",
      "**Keep the exercises the same for a full phase.** Four weeks is a useful block. Swapping exercises every week makes progress hard to see.",
      "**Change one thing at a time.** If progress stalls, check sleep, food, and consistency before changing the plan, then adjust a single variable and give it a week or two.",
    ]],

    ["h2", "Protein and calories"],
    ["p", "The International Society of Sports Nutrition's position stand puts daily protein at **1.4 to 2.0 grams per kilogram of body weight** for most exercising people. That works out to roughly 0.6 to 0.9 grams per pound. Several of the recomposition studies in the Barakat review used intakes above 2.0 grams per kilogram in trained lifters."],
    ["p", "You don't need a crash diet. The review includes studies that showed recomposition with a calorie deficit and others with a small surplus driven by extra protein. A modest intake you can keep up for months is more useful than an aggressive one you abandon in week three."],
    ["note", "If you have kidney disease or another medical condition, check your protein target with your doctor first."],

    ["h2", "How to track it"],
    ["p", "Use several measures, because weight alone can hide a recomposition:"],
    ["list", [
      "**Waist and other tape measurements,** taken the same way every time.",
      "**Progress photos** in the same light, angle, and clothing.",
      "**Strength in your training log.** More reps at the same weight is progress.",
      "**Weekly average body weight** rather than single weigh-ins.",
    ]],
    ["callout", {
      title: "How Body Rebuild is set up",
      list: [
        `**${PROGRAM.weeks} weeks in four phases:** Rebuild, Build, Strengthen, and Consolidate.`,
        `**${PROGRAM.requiredWorkouts} required workouts a week** plus an optional Rebuild Accelerator session.`,
        "**Six programs:** Foundation, Build, and Performance, each in a Home and a Gym version.",
        "**Nutrition by macro, portion, or hybrid tracking,** depending on what you will actually keep doing. No rigid meal plans.",
      ],
      link: { href: "/body-rebuild", label: "See how Body Rebuild works" },
    }],

    ["faq", [
      ["Can you lose fat and build muscle at the same time?", "Yes. Research reviewed by Barakat and colleagues in 2020 shows it in beginners, in people returning after a break, and in trained lifters. Progressive strength training and enough protein are the two main drivers. How much any one person changes varies a lot."],
      ["How long does body recomposition take?", "The studies in the Barakat review measured changes over programs of about 6 to 11 weeks, and the size of the change varied widely between people. Body Rebuild runs 16 weeks."],
      ["How many days a week should I lift for body recomposition?", "Three full-body strength sessions a week is a practical plan when you are restarting. It meets the CDC's guideline of muscle-strengthening work on at least two days a week and leaves room to recover."],
      ["Do I have to count calories?", "Not necessarily. Some people do best tracking calories and protein, others with portion guides, and many with a mix. The best method is the one you will still be using in month three."],
    ]],
  ],

  sources: [
    {
      name: "Barakat C, Pearson J, Escalante G, Campbell B, De Souza EO. Body Recomposition: Can Trained Individuals Build Muscle and Lose Fat at the Same Time?",
      url: BARAKAT,
      detail: "Strength and Conditioning Journal 42(5):7-21, October 2020.",
      accessed: "2026-09-22",
      figures: [],
    },
    {
      name: "Jäger R, et al. International Society of Sports Nutrition Position Stand: protein and exercise",
      url: ISSN,
      detail: "Journal of the International Society of Sports Nutrition, 2017: 1.4 to 2.0 g of protein per kg of body weight per day for most exercising individuals.",
      accessed: "2026-09-22",
      figures: [],
    },
    {
      name: "Centers for Disease Control and Prevention, Adult Activity: An Overview",
      url: CDC,
      detail: "Physical Activity Guidelines for Americans: 150 minutes of moderate-intensity activity and muscle-strengthening activity on 2 or more days a week.",
      accessed: "2026-09-22",
      figures: [],
    },
  ],

  related: [G_RESTART, R_BODY_REBUILD, R_ASSESSMENT],
};
