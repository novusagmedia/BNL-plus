import { PROGRAM } from "../facts.mjs";
import { R_BODY_REBUILD, R_ASSESSMENT, G_RECOMP } from "../related.mjs";

// Target terms (Semrush US, 2026-09-22): how to start working out again
// 390/KD 19 · how to get back into working out 390/KD 30 · getting back in
// shape 210/KD 20.

const CDC = "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html";

export default {
  slug: "start-working-out-again",
  title: "How to Start Working Out Again After Time Off | BNL Plus",
  description:
    "Getting back into working out after months off? Start smaller than you think, repeat the same plan for four weeks, and build a routine that survives a bad week.",
  eyebrow: "Restarting",
  crumb: "Start working out again",
  h1: "How to start working out again",
  lead:
    "You have done this before, and it didn't stick. Here is a first four weeks built for the schedule you actually have, and for the week that goes wrong.",
  answer:
    "Start smaller than feels useful: **two or three short strength sessions a week**, finishing most sets with **a few reps left in the tank**, plus walking on other days. Keep the same exercises for four weeks and **add reps before you add weight**. The first month is for rebuilding the habit and the movements, not for making up lost time.",
  published: "2026-09-22",

  blocks: [
    ["h2", "What the guidelines actually ask for"],
    ["p", `The CDC's guideline for adults is 150 minutes of moderate activity a week, such as brisk walking, plus muscle-strengthening work on **at least two days a week** that covers the major muscle groups: legs, hips, back, abdomen, chest, shoulders, and arms.`],
    ["p", "That is the target, not the starting line. The same guidance says some activity is better than none, and the 150 minutes don't have to happen all at once. If you have been off for months, two strength sessions and a few walks is a real start."],

    ["h2", "Why restarts stall"],
    ["p", "Most restarts don't fail because someone is lazy. They fail because the plan was built for a different week than the one that showed up. The usual culprits:"],
    ["list", [
      "**Starting at your old intensity.** The soreness costs you the next two sessions, and the streak ends in week one.",
      "**A plan that needs more time than you have.** Five 75-minute sessions look great on paper and don't fit around work and family.",
      "**Changing the plan every week.** New exercises feel productive, but you never repeat anything long enough to see it improve.",
      "**No record of progress.** Without a log, the only feedback is the mirror and the scale, and both are slow.",
      "**Nobody noticing when you stop.** A missed week turns into a missed month quietly.",
    ]],

    ["h2", "A simple first four weeks"],
    ["list", [
      "**Three strength sessions a week, on days you can protect.** If three isn't realistic yet, two meets the CDC minimum. Consistency beats ambition here.",
      "**Full-body sessions built on basic patterns:** a squat or sit-to-stand, a hip hinge, a push, a pull, and a carry or core exercise.",
      "**Stop most sets with one to three reps in reserve.** You should finish feeling like you could have done a little more. Soreness should be mild enough that it doesn't cost you the next session.",
      "**Keep the same exercises for all four weeks.** Add a rep or two before you add weight. Repeating the plan is how you see progress.",
      "**Walk on the other days.** It counts toward the 150 minutes and helps recovery without adding strain.",
      "**Write every session down.** A log is the proof that you are doing it, and it tells you when it is time to add load.",
    ]],
    ["callout", {
      title: "Decide your minimum session now",
      body: [
        "The week will go wrong at some point. Decide ahead of time what a minimum session looks like, for example 20 minutes and three exercises, so a bad week shrinks instead of stopping.",
      ],
    }],

    ["h2", "At home or at a gym"],
    ["p", "Either works. Pick the one you will actually get to three times a week. At home, adjustable dumbbells, resistance bands, a bench or sturdy chair, and safe floor space are enough to train every major muscle group. A gym gives you more equipment and a place that means \"training\", which helps some people show up."],

    ["h2", "How Body Rebuild handles the restart"],
    ["p", `Body Rebuild is built around this problem. It runs ${PROGRAM.weeks} weeks in four phases, with ${PROGRAM.requiredWorkouts} required workouts a week and an optional fourth:`],
    ["list", [
      "**Rebuild (weeks 1 to 4):** technique, consistency, starting loads, and managing soreness.",
      "**Build (weeks 5 to 8):** adding reps and load, and building work capacity.",
      "**Strengthen (weeks 9 to 12):** progressive overload and technique under more effort.",
      "**Consolidate (weeks 13 to 16):** showing the progress and building independence for what comes next.",
    ]],
    ["p", "Every track has a Home and a Gym version, at Foundation, Build, or Performance level. The [Restart Assessment](/restart-assessment) suggests which level fits where you are now."],

    ["h2", "When to check with a doctor first"],
    ["p", "If you have pain, an injury, a heart condition or another medical condition, or you are simply unsure, talk to your doctor before you start. BNL Plus screens every applicant's health readiness and may ask for medical clearance. It provides fitness and general nutrition coaching, and it does not diagnose or treat injuries."],

    ["faq", [
      ["How many days a week should I work out when I'm starting again?", "Two to three strength sessions a week is a practical start. The CDC guideline for adults is muscle-strengthening work on at least two days a week, plus 150 minutes of moderate activity such as brisk walking."],
      ["Is it normal to be sore after starting again?", "Some soreness in the first weeks is common. If it is bad enough to make you skip the next session, the starting effort was too high, so ease off. Sharp pain, or pain that doesn't ease, is a reason to stop and get it checked."],
      ["Should I go back to my old workout?", "Not at the old weights or volume. Start well below where you left off, keep the same exercises for a few weeks, and let the log tell you when to add load."],
      ["What if I've quit before?", "That is the usual story, and it is why the plan should be built for the week that goes wrong. Decide on a minimum session in advance, and make sure someone or something notices when you miss."],
    ]],
  ],

  sources: [
    {
      name: "Centers for Disease Control and Prevention, Adult Activity: An Overview",
      url: CDC,
      detail: "Physical Activity Guidelines for Americans: 150 minutes of moderate-intensity activity a week and muscle-strengthening activity on 2 or more days a week. Page reviewed December 20, 2023.",
      accessed: "2026-09-22",
      figures: [],
    },
  ],

  related: [G_RECOMP, R_ASSESSMENT, R_BODY_REBUILD],
};
