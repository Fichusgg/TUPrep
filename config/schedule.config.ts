/**
 * THE single source of truth for dates, hour budgets and pacing.
 * Edit this file and the schedule, countdowns, AP badges and timed-test budgets regenerate from it.
 *
 * Status labels:
 *   CONFIRMED  — read in an official 2027-2028 document (checked 24 Oct 2026)
 *   ESTIMATED  — our assumption; change it when you know more
 */

export type Status = "CONFIRMED" | "ESTIMATED";

export interface TestDate {
  id: "delft-cst" | "tue-selection";
  label: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  status: Status;
  note: string;
  parts: ("math" | "logic" | "algorithmic")[];
}

export interface KeyDate {
  label: string;
  date: string;
  status: Status;
}

export interface Phase {
  id: "P0" | "P1" | "P2" | "P3" | "P4";
  title: string;
  start: string;
  end: string;
  /** Units introduced in this phase, in teaching order. */
  units: string[];
  summary: string;
}

export const scheduleConfig = {
  /** Monday the plan starts. */
  startDate: "2026-10-26",
  /** ISO weekday that is kept completely free (7 = Sunday). */
  restDay: 7,
  /** Days before each test without new material. */
  taperDays: 3,

  hours: {
    normal: 8,
    heavy: 12,
    /** Multiplier for the one lighter week per month. */
    lightFactor: 0.6,
  },
  /** Mondays of heavy-prep weeks (12 h). Winter-break weeks are extra capacity, not guaranteed. */
  heavyWeeks: ["2026-12-21", "2026-12-28", "2027-02-08", "2027-02-22"],
  optionalHeavyWeeks: ["2026-12-21", "2026-12-28"],
  /** Mondays of the lighter week each month (aligned with AP unit exams where possible). */
  lightWeeks: ["2026-11-16", "2026-12-14", "2027-01-11"],

  /**
   * Share of weekly STUDY hours (your choice: extra time for logic + algorithmic).
   * This does not change the tests themselves: mocks, timed tests and scores always follow the real format and weights
   * (CST: Maths 50% / SR&LT 50%; TU/e: Maths 10% / Logic 40% / Algorithmic 40%) — see content/tests/blueprints.json.
   */
  allocation: {
    logicAlgorithmic: 0.625,
    math: 0.175,
    mocksReview: 0.2,
  },
  /** How the logic+algorithmic share is split while both are being taught. */
  logicShareOfLA: 0.5,

  tests: [
    {
      id: "delft-cst",
      label: "TU Delft Cognitive Skills Test",
      date: "2027-02-18",
      status: "CONFIRMED",
      note: "Brochure 2 (2027-2028): online on Thu 18 Feb OR Tue 23 Feb 2027, 10:00–22:00 CET. You state a preference; TU Delft confirms your date before 9 Feb. Set the date you get here.",
      parts: ["math", "logic"],
    },
    {
      id: "tue-selection",
      label: "TU/e online selection day",
      date: "2027-03-06",
      status: "CONFIRMED",
      note: "Departmental regulations 2027-2028 art. 3.3b and the BCS dates PDF: Saturday 6 March 2027, three online tests (Mathematics, Logical Reasoning, Algorithmic Thinking), proctored with Pruefster.",
      parts: ["math", "logic", "algorithmic"],
    },
  ] satisfies TestDate[],

  keyDates: [
    { label: "Application deadline (Studielink, both)", date: "2027-01-15", status: "CONFIRMED" },
    { label: "TU Delft: OSE deadline", date: "2027-02-02", status: "CONFIRMED" },
    { label: "TU Delft: CST preparation lecture (week of)", date: "2027-02-02", status: "ESTIMATED" },
    { label: "TU/e: selection-day instructions arrive (latest)", date: "2027-02-05", status: "CONFIRMED" },
    { label: "TU Delft: proctoring trial run opens (until 16 Feb)", date: "2027-02-09", status: "CONFIRMED" },
    { label: "TU/e: motivation & capacities questionnaire due", date: "2027-02-14", status: "CONFIRMED" },
    { label: "TU Delft: CST alternative date", date: "2027-02-23", status: "CONFIRMED" },
    { label: "TU Delft: Teamwork Assignment window (2–9 Mar)", date: "2027-03-02", status: "CONFIRMED" },
    { label: "Ranking numbers (both, Studielink)", date: "2027-04-15", status: "CONFIRMED" },
    { label: "AP Calculus BC exam", date: "2027-05-10", status: "CONFIRMED" },
  ] satisfies KeyDate[],

  phases: [
    {
      id: "P0",
      title: "Baseline & setup",
      start: "2026-10-26",
      end: "2026-11-08",
      units: [],
      summary: "One diagnostic per part (untimed, then timed), set up the error log, skim every unit overview.",
    },
    {
      id: "P1",
      title: "Foundations",
      start: "2026-11-09",
      end: "2026-12-13",
      units: ["L1", "A1", "M1", "L2", "A2", "M2", "L3", "A3", "M3", "M4"],
      summary: "Work through L1–L3, A1–A3 and M1–M4 with daily Bebras-style warm-ups; start the error log.",
    },
    {
      id: "P2",
      title: "Skill build",
      start: "2026-12-14",
      end: "2027-01-10",
      units: ["L4", "A4", "M5", "L5", "A5", "M6", "A6", "M7"],
      summary: "Timed unit tests. L4–L5, A4–A6, M5–M7. Winter break = optional extra capacity.",
    },
    {
      id: "P3",
      title: "Mixed practice & first mocks",
      start: "2027-01-11",
      end: "2027-01-31",
      units: [],
      summary: "Mixed sets, weakest-topic drills, first full mocks, proctoring/equipment readiness check.",
    },
    {
      id: "P4",
      title: "Exam rhythm & taper",
      start: "2027-02-01",
      end: "2027-03-06",
      units: [],
      summary: "One full mock per week under exam rules, review the next day, targeted drills, taper before each test.",
    },
  ] satisfies Phase[],

  /** Seconds per question used for timed unit tests (ESTIMATED from the official section lengths). */
  pace: {
    /** CST: 60 min for Mathematics; assuming ~20 questions. */
    math: 180,
    /** CST: 45 min for SR&LT; assuming ~20 questions. */
    logic: 135,
    /** TU/e: 3 h for three tests → assume 60 min and ~25 questions per test. */
    algorithmic: 144,
  },
  paceStatus: "ESTIMATED" as Status,

  /** Your AP Calculus BC pacing (remaining weeks), used for the "Covered in AP" badges. */
  apPacing: [
    { week: 8, start: "2026-10-27", end: "2026-11-02", topic: "U4 differentials, Newton's method, L'Hôpital" },
    { week: 9, start: "2026-11-03", end: "2026-11-09", topic: "U5 extrema, MVT, concavity" },
    { week: 10, start: "2026-11-10", end: "2026-11-16", topic: "U5 graphing, optimisation" },
    { week: 11, start: "2026-11-17", end: "2026-11-23", topic: "U4–5 review & exam" },
    { week: 0, start: "2026-11-24", end: "2026-11-30", topic: "Break" },
    { week: 12, start: "2026-12-01", end: "2026-12-07", topic: "U6 area & definite integral" },
    { week: 13, start: "2026-12-08", end: "2026-12-14", topic: "U6 FTC & u-substitution" },
    { week: 14, start: "2026-12-15", end: "2026-12-21", topic: "U6 integration by parts & partial fractions" },
    { week: 0, start: "2026-12-22", end: "2026-12-31", topic: "Break" },
    { week: 15, start: "2027-01-05", end: "2027-01-11", topic: "U6 improper & trig integrals" },
    { week: 16, start: "2027-01-12", end: "2027-01-18", topic: "U6 review & exam" },
    { week: 17, start: "2027-01-19", end: "2027-01-25", topic: "U7 differential equations" },
    { week: 18, start: "2027-01-26", end: "2027-02-01", topic: "U7 Euler & logistic" },
    { week: 19, start: "2027-02-02", end: "2027-02-08", topic: "U8 applications of integration" },
    { week: 20, start: "2027-02-09", end: "2027-02-15", topic: "U8 volumes" },
    { week: 21, start: "2027-02-16", end: "2027-02-22", topic: "U7–8 review" },
    { week: 22, start: "2027-02-23", end: "2027-03-01", topic: "U9 parametric" },
    { week: 23, start: "2027-03-02", end: "2027-03-08", topic: "U9" },
    { week: 24, start: "2027-03-09", end: "2027-03-15", topic: "U9 polar & vectors" },
    { week: 25, start: "2027-03-16", end: "2027-03-22", topic: "U9" },
    { week: 26, start: "2027-03-23", end: "2027-03-29", topic: "U10 series" },
  ],

  /**
   * When each maths unit's AP content is available.
   * "before-start" = already covered before 26 Oct 2026; a date = covered by that date; null = not in time → pre-learn.
   */
  apCoverage: {
    M1: { coveredBy: "before-start", note: "Algebra and functions are prerequisites of AP Calc / IB." },
    M2: { coveredBy: "before-start", note: "Limits covered before 26 Oct." },
    M3: { coveredBy: "before-start", note: "Derivative rules, chain rule, implicit and inverse/log derivatives covered before 26 Oct." },
    M4: { coveredBy: "2026-11-16", note: "Related rates done; extrema/MVT/concavity (wk 9) and graphing/optimisation (wk 10)." },
    M5: { coveredBy: "2026-12-14", note: "Area & definite integral (wk 12), FTC & u-sub (wk 13). Volumes of revolution only in U8 (9–15 Feb) — pre-learn those." },
    M6: { coveredBy: null, note: "Exp/log/trig derivatives are covered, but trig equations, exact values and identities are pre-calculus — pre-learn (IB HL/SL covers part of it)." },
    M7: { coveredBy: null, note: "Vectors arrive in AP U9 (9–15 Mar), after both tests; geometry (sine/cosine rule, circles) is pre-calculus — pre-learn." },
  } as Record<string, { coveredBy: string | null; note: string }>,
} as const;

export type ScheduleConfig = typeof scheduleConfig;
