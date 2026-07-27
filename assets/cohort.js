/**
 * Coaching cohort messaging — single source of truth for the whole site.
 *
 * WHY THIS EXISTS
 * The August 10 cohort dates were hardcoded into ten HTML files in twenty-odd
 * places. Once the application deadline passed, every page would have gone on
 * advertising a closed date with no way to take a lead. Applications must stay
 * open regardless of what any particular cohort's dates are.
 *
 * HOW IT WORKS (progressive enhancement — read this before editing)
 * The HTML always ships the EVERGREEN copy, which is true forever and needs no
 * JavaScript. This script only *upgrades* those elements to the specific dated
 * copy while a confirmed cohort deadline is still in the future. So:
 *
 *   - JavaScript off        -> evergreen copy, applications open. Correct.
 *   - Deadline in future    -> dated copy with urgency. Correct.
 *   - Deadline passed       -> falls back to evergreen automatically. Correct.
 *
 * Nothing ever shows a date that has already gone by, and nothing ever tells a
 * visitor that applications are closed.
 *
 * TO SET THE NEXT COHORT
 * Edit COHORT below and nothing else. To go back to rolling admission, set
 * applicationDeadlineISO to null.
 *
 * Handoff §15.2 permits exactly this: cohort dates OR next-cohort messaging,
 * shown only while the configuration is current.
 */
(function () {
  "use strict";

  var COHORT = {
    // Set all four together when a cohort is confirmed; null out the ISO
    // deadline to return every surface to evergreen copy immediately.
    startDate: "August 10, 2026",
    startDateShort: "August 10",
    applicationDeadline: "August 7",
    applicationDeadlineFull: "August 7, 2026",
    // End of day in US/Mountain — the sub-account's business timezone (§7.1).
    applicationDeadlineISO: "2026-08-07T23:59:59-06:00",
    capacity: 10,
  };

  function isCurrent(now) {
    if (!COHORT.applicationDeadlineISO || !COHORT.startDate) return false;
    var deadline = new Date(COHORT.applicationDeadlineISO);
    if (isNaN(deadline.getTime())) return false;
    return now.getTime() <= deadline.getTime();
  }

  /**
   * Dated copy per slot. Evergreen copy is NOT here on purpose — it lives in
   * the HTML so the page is correct before this script runs.
   */
  var DATED = {
    banner: function () {
      return (
        "Applications are open for the " + COHORT.startDateShort +
        " Body Rebuild Coaching cohort. Applications close " + COHORT.applicationDeadline +
        ". Limited to " + COHORT.capacity + " participants."
      );
    },
    "hero-lead": function () {
      return "Next Coaching cohort — " + COHORT.startDate + ".";
    },
    "hero-rest": function () {
      return (
        " Applications close " + COHORT.applicationDeadline +
        ". Limited to " + COHORT.capacity + " participants."
      );
    },
    "tiers-detail": function () {
      return (
        "Next cohort planned for " + COHORT.startDate +
        ". Applications close " + COHORT.applicationDeadline + "."
      );
    },
    "apply-detail": function () {
      return [
        "Next Coaching cohort planned for " + COHORT.startDate + ".",
        "Applications close " + COHORT.applicationDeadline + ".",
        "Maximum " + COHORT.capacity + " Coaching participants.",
      ];
    },
    cta: function () {
      return "Apply for the " + COHORT.startDateShort.split(" ")[0] + " Cohort";
    },
    faq: function () {
      return (
        "The next Coaching cohort is planned for " + COHORT.startDate +
        ". Applications close " + COHORT.applicationDeadline +
        ". Dates may be updated before enrollment is finalized."
      );
    },
    // Used by the assessment result page for Coaching-tier results.
    result: function () {
      return (
        "Planned start: " + COHORT.startDate +
        " · Applications close: " + COHORT.applicationDeadlineFull +
        " · Capacity: " + COHORT.capacity
      );
    },
  };

  /** Replace an element's text with multiple lines separated by <br>. */
  function setLines(el, lines) {
    el.textContent = "";
    lines.forEach(function (line, index) {
      if (index > 0) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  }

  function apply(now) {
    if (!isCurrent(now || new Date())) return; // evergreen HTML already correct

    var nodes = document.querySelectorAll("[data-cohort]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var build = DATED[el.getAttribute("data-cohort")];
      if (!build) continue;

      var value = build();
      if (Array.isArray(value)) setLines(el, value);
      else el.textContent = value;
    }
  }

  // Exposed so the assessment result page can render the same copy for the
  // Coaching tier without duplicating the configuration.
  window.BNL_COHORT = {
    capacity: COHORT.capacity,
    isCurrent: function (now) {
      return isCurrent(now || new Date());
    },
    resultLine: function (now) {
      return isCurrent(now || new Date())
        ? DATED.result()
        : "Applications are open for the next Coaching cohort. Maximum " +
            COHORT.capacity +
            " participants. Your start date is confirmed with you when you apply.";
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      apply();
    });
  } else {
    apply();
  }
})();
