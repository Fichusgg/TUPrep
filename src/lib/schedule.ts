/**
 * Week-by-week study plan generated purely from config/schedule.config.ts and the content files.
 * Change the config (dates, hours, phases) and the plan regenerates; task ids are deterministic so
 * checked-off tasks survive as long as the structure of a week does not change.
 */
import { scheduleConfig, type Phase, type ScheduleConfig } from "@config/schedule.config";
import { BANK, RESOURCE_BY_ID, UNIT_BY_ID, UNIT_TESTS, UNITS } from "@/content";
import type { PartId } from "@/content/schema";

// ------------------------------------------------------------------ dates

/** ISO date helpers (calendar dates, no time zone surprises). */
export function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function utcToIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
export function addDaysIso(iso: string, n: number): string {
  return utcToIso(isoToUtc(iso) + n * 86_400_000);
}
/** ISO weekday 1 = Monday … 7 = Sunday. */
export function weekday(iso: string): number {
  const d = new Date(isoToUtc(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}
export function mondayOf(iso: string): string {
  return addDaysIso(iso, 1 - weekday(iso));
}
export function todayIso(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((isoToUtc(b) - isoToUtc(a)) / 86_400_000);
}

// ------------------------------------------------------------------ types

export type TaskKind =
  | "setup"
  | "diagnostic"
  | "read"
  | "resource"
  | "prelearn"
  | "practice"
  | "warmup"
  | "challenge"
  | "timed-test"
  | "review"
  | "mock"
  | "mock-review"
  | "drill"
  | "readiness"
  | "taper"
  | "test-day";

export interface Task {
  id: string;
  date: string;
  title: string;
  kind: TaskKind;
  minutes: number;
  href: string;
  unit?: string;
  part?: PartId;
  resourceId?: string;
}

export type CheckpointMetric =
  | { kind: "unit-test"; unit: string; target: number }
  | { kind: "practice"; part?: PartId; count: number; accuracy: number }
  | { kind: "mock"; target: number }
  | { kind: "none" };

export interface Week {
  index: number;
  start: string;
  end: string;
  phase: Phase;
  hours: number;
  kind: "normal" | "heavy" | "light";
  optionalExtra: boolean;
  focus: string[];
  tasks: Task[];
  checkpoint: { text: string; metric: CheckpointMetric };
  notes: string[];
}

// --------------------------------------------------------------- helpers

const MATH_UNITS = UNITS.filter((u) => u.part === "math").map((u) => u.id);
const avgSeconds = (unit: string) => {
  const qs = BANK.filter((q) => q.unit === unit);
  return qs.reduce((s, q) => s + q.estSeconds, 0) / Math.max(1, qs.length);
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Spread a unit queue evenly over the weeks of a phase: unit i covers weeks [⌊iW/n⌋, ⌊(i+1)W/n⌋). */
function spread(units: string[], weeks: number): Map<number, string[]> {
  const out = new Map<number, string[]>();
  units.forEach((u, i) => {
    const a = Math.floor((i * weeks) / units.length);
    const b = Math.max(a + 1, Math.floor(((i + 1) * weeks) / units.length));
    for (let w = a; w < b && w < weeks; w++) out.set(w, [...(out.get(w) ?? []), u]);
  });
  return out;
}

export function apStatus(unitId: string, onIso: string, cfg: ScheduleConfig = scheduleConfig): { label: string; tone: "good" | "warn" | "info"; note: string } | null {
  const ap = cfg.apCoverage[unitId];
  if (!ap) return null;
  if (ap.coveredBy === "before-start") return { label: "Covered in AP (before 26 Oct)", tone: "good", note: ap.note };
  if (ap.coveredBy === null) return { label: "Pre-learn needed", tone: "warn", note: ap.note };
  return onIso >= ap.coveredBy
    ? { label: `Covered in AP (since ${ap.coveredBy})`, tone: "good", note: ap.note }
    : { label: `Covered in AP by ${ap.coveredBy}`, tone: "info", note: ap.note };
}

// ------------------------------------------------------------------ build

export function buildSchedule(cfg: ScheduleConfig = scheduleConfig): Week[] {
  const tests = [...cfg.tests].sort((a, b) => a.date.localeCompare(b.date));
  const lastTest = tests[tests.length - 1].date;
  const taperDays = new Set<string>();
  for (const t of tests) for (let k = 1; k <= cfg.taperDays; k++) taperDays.add(addDaysIso(t.date, -k));

  const starts: string[] = [];
  for (let s = mondayOf(cfg.startDate); s <= lastTest; s = addDaysIso(s, 7)) starts.push(s);

  // Unit focus per teaching phase, spread separately per part.
  const focusByWeek = new Map<number, string[]>();
  for (const ph of cfg.phases) {
    const idx = starts.map((s, i) => [s, i] as const).filter(([s]) => s >= ph.start && s <= ph.end).map(([, i]) => i);
    if (!idx.length || !ph.units.length) continue;
    for (const part of ["logic", "algorithmic", "math"] as const) {
      const queue = ph.units.filter((u) => UNIT_BY_ID[u]?.part === part);
      for (const [w, us] of spread(queue, idx.length)) focusByWeek.set(idx[w], [...(focusByWeek.get(idx[w]) ?? []), ...us]);
    }
  }
  const firstWeekOf = new Map<string, number>();
  const lastWeekOf = new Map<string, number>();
  for (const [w, us] of [...focusByWeek].sort((a, b) => a[0] - b[0])) {
    for (const u of us) {
      if (!firstWeekOf.has(u)) firstWeekOf.set(u, w);
      lastWeekOf.set(u, w);
    }
  }

  const REPEATABLE = new Set(["foc-ch2", "delftx-precalc", "bebras-uk", "tue-math-practice", "cst-lecture-2024"]);
  const usedResources = new Set<string>(["tud-brochure2", "yt-logic-prep", "yt-alg-prep", "yt-math-prep", "bebras-uk"]);

  return starts.map((start, index) => {
    const end = addDaysIso(start, 6);
    const phase = cfg.phases.find((p) => start >= p.start && start <= p.end) ?? cfg.phases[cfg.phases.length - 1];
    const heavy = (cfg.heavyWeeks as readonly string[]).includes(start);
    const light = (cfg.lightWeeks as readonly string[]).includes(start);
    const kind: Week["kind"] = heavy ? "heavy" : light ? "light" : "normal";
    const hours = heavy ? cfg.hours.heavy : light ? Math.round(cfg.hours.normal * cfg.hours.lightFactor * 10) / 10 : cfg.hours.normal;
    const optionalExtra = (cfg.optionalHeavyWeeks as readonly string[]).includes(start);
    const days = Array.from({ length: 7 }, (_, i) => addDaysIso(start, i)).filter((d) => weekday(d) !== cfg.restDay && d >= cfg.startDate);
    const testsThisWeek = tests.filter((t) => t.date >= start && t.date <= end);
    const studyDays = days.filter((d) => !testsThisWeek.some((t) => t.date === d) && d <= lastTest);
    const newMaterialDays = studyDays.filter((d) => !taperDays.has(d));
    const focus = focusByWeek.get(index) ?? [];
    const budget = hours * 60;
    const notes: string[] = [];
    if (optionalExtra) notes.push("Winter break: the extra hours are optional capacity, not a requirement.");
    if (light) notes.push("Lighter week (one per month) — aligned with an AP unit exam where possible.");

    // prio: lower = more important; used to trim the week down to its hour budget.
    type Draft = Omit<Task, "id" | "date"> & { prio?: number };
    const tasks: Draft[] = [];
    const pinned: { task: Draft; date: string }[] = [];
    const add = (t: Draft) => tasks.push(t);
    const pin = (date: string, t: Draft) => pinned.push({ task: t, date });

    const LA = budget * cfg.allocation.logicAlgorithmic;
    const MATH = budget * cfg.allocation.math;
    const REVIEW = budget * cfg.allocation.mocksReview;

    const practiceTask = (unit: string, n: number, kindT: TaskKind = "practice", prio = 5): Draft => ({
      prio,
      title: kindT === "challenge" ? `Challenge set (hard only): ${unit} — ${n} questions` : `Practice ${unit}: ${n} questions`,
      kind: kindT,
      minutes: Math.max(10, Math.round((n * avgSeconds(unit)) / 60 / 5) * 5),
      href: `/units/${unit}?tab=practice${kindT === "challenge" ? "&mode=challenge" : ""}`,
      unit,
      part: UNIT_BY_ID[unit].part,
    });

    let checkpoint: Week["checkpoint"] = { text: "Complete at least 75% of this week's tasks.", metric: { kind: "none" } };

    // ---------------------------------------------------------- per phase
    if (phase.id === "P0") {
      if (index === 0) {
        add({ title: "Read the Exam info page and check the test dates in config/schedule.config.ts", kind: "setup", minutes: 20, href: "/exams" });
        add({ title: "Skim the overview of every unit", kind: "setup", minutes: 45, href: "/units" });
        add({ title: "Read Brochure 2 (syllabus + formula sheet)", kind: "resource", minutes: 60, href: "/resources", resourceId: "tud-brochure2" });
        for (const part of ["logic", "algorithmic", "math"] as const) {
          add({ title: `Diagnostic (untimed): ${part === "math" ? "Maths" : part === "logic" ? "Logic" : "Algorithmic"} — 12 mixed questions`, kind: "diagnostic", minutes: 35, href: `/practice?part=${part}&count=12&label=diagnostic`, part });
        }
        for (const r of ["yt-logic-prep", "yt-alg-prep", "yt-math-prep"]) {
          add({ title: `Watch: ${RESOURCE_BY_ID[r].title}`, kind: "resource", minutes: RESOURCE_BY_ID[r].minutes, href: "/resources", resourceId: r });
        }
        checkpoint = { text: "All three untimed diagnostics done (36 questions).", metric: { kind: "practice", count: 36, accuracy: 0 } };
      } else {
        for (const part of ["logic", "algorithmic", "math"] as const) {
          add({ title: `Diagnostic (timed): ${part === "math" ? "Maths" : part === "logic" ? "Logic" : "Algorithmic"} — 12 questions at exam pace`, kind: "diagnostic", minutes: Math.round((12 * cfg.pace[part]) / 60), href: `/practice?part=${part}&count=12&timed=1&label=diagnostic`, part });
        }
        add({ title: "Tag the error type of every diagnostic mistake", kind: "review", minutes: 30, href: "/review" });
        add({ title: "Bebras warm-up: past Elite challenge (bebras.uk)", kind: "warmup", minutes: 40, href: "/resources", resourceId: "bebras-uk" });
        add({ title: "Read Foundations of Computation ch. 2 — sections 2.1–2.2", kind: "resource", minutes: 90, href: "/resources", resourceId: "foc-ch2" });
        checkpoint = { text: "Timed diagnostics done: 36 questions answered; note your baseline accuracy per part.", metric: { kind: "practice", count: 36, accuracy: 0 } };
      }
    } else if (phase.id === "P1" || phase.id === "P2") {
      const la = focus.filter((u) => UNIT_BY_ID[u].part !== "math");
      const ma = focus.filter((u) => UNIT_BY_ID[u].part === "math");
      const finishing: string[] = [];
      const fill = (units: string[], minutes: number) => {
        if (!units.length) return;
        const per = minutes / units.length;
        for (const u of units) {
          let left = per;
          const unit = UNIT_BY_ID[u];
          const first = firstWeekOf.get(u) === index;
          const last = lastWeekOf.get(u) === index;
          if (first) {
            add({ prio: 1, title: `Overview & key ideas: ${u} ${unit.title}`, kind: "read", minutes: 20, href: `/units/${u}`, unit: u, part: unit.part });
            left -= 20;
            if (unit.part === "math") {
              const ap = apStatus(u, end, cfg);
              if (ap && ap.tone !== "good") {
                add({ prio: 2, title: `Pre-learn ${u} with DelftX Pre-University Calculus (${ap.label})`, kind: "prelearn", minutes: 45, href: "/resources", unit: u, part: "math", resourceId: "delftx-precalc" });
                left -= 45;
              }
            }
            // One resource per unit (two if time allows); multi-part resources may recur, others are used once.
            let added = 0;
            for (const rid of unit.resources) {
              const r = RESOURCE_BY_ID[rid];
              if (!r || r.id === "delftx-precalc" || added >= 2) continue;
              if (!REPEATABLE.has(rid) && usedResources.has(rid)) continue;
              usedResources.add(rid);
              const m = Math.min(r.minutes, 45);
              add({ prio: added === 0 ? 3 : 7, title: REPEATABLE.has(rid) ? `Study: ${r.title} — the part on ${u}` : `Study: ${r.title}`, kind: "resource", minutes: m, href: "/resources", unit: u, part: unit.part, resourceId: rid });
              left -= m;
              added++;
            }
          }
          for (let k = 0; k < 2; k++) {
            const p = practiceTask(u, 10, "practice", 4);
            add(p);
            left -= p.minutes;
          }
          if (last) {
            const t = UNIT_TESTS.find((x) => x.unit === u)!;
            const m = Math.round((t.count * cfg.pace[unit.part]) / 60) + 10;
            const day = testDays[testSlot++ % Math.max(1, testDays.length)] ?? studyDays[studyDays.length - 1];
            pin(day, { prio: 0, title: `Timed test: ${u} (${t.count} questions, no going back)`, kind: "timed-test", minutes: m, href: `/units/${u}?tab=test`, unit: u, part: unit.part });
            left -= m;
            finishing.push(u);
          }
          if (phase.id === "P2" && !first) {
            const c = practiceTask(u, 8, "challenge", 6);
            add(c);
            left -= c.minutes;
          }
          let n = 0;
          while (left >= 15 && n < 4) {
            const p = practiceTask(u, 10, "practice", 8);
            add(p);
            left -= p.minutes;
            n++;
          }
        }
      };
      // Timed tests go on the last new-material days, one per day where possible.
      const testDays = [...newMaterialDays].reverse();
      let testSlot = 0;
      // Phase 1: daily Bebras-style warm-ups come out of the logic+algorithmic share.
      let laBudget = LA;
      if (phase.id === "P1") {
        for (const d of newMaterialDays) pin(d, { prio: 6, title: "Warm-up: 5 algorithmic puzzles", kind: "warmup", minutes: 10, href: "/practice?part=algorithmic&count=5&label=warmup", part: "algorithmic" });
        laBudget -= 10 * newMaterialDays.length;
      }
      fill(la, laBudget);
      fill(ma, MATH);
      add({ prio: 2, title: "Review queue (error log, spaced review)", kind: "review", minutes: Math.round(REVIEW / 2), href: "/review" });
      add({ prio: 9, title: "Review queue + tag error types", kind: "review", minutes: Math.round(REVIEW / 2), href: "/review" });
      checkpoint = finishing.length
        ? { text: `Score at least 70% on the ${finishing[0]} timed test.`, metric: { kind: "unit-test", unit: finishing[0], target: 70 } }
        : { text: "Answer at least 30 practice questions this week with 65%+ accuracy.", metric: { kind: "practice", count: 30, accuracy: 65 } };
    } else if (phase.id === "P3") {
      const wInPhase = starts.filter((s) => s >= phase.start && s < start).length;
      add({ title: "Mixed practice: Logic — 15 questions", kind: "practice", minutes: 35, href: "/practice?part=logic&count=15", part: "logic" });
      add({ title: "Mixed practice: Algorithmic — 15 questions", kind: "practice", minutes: 35, href: "/practice?part=algorithmic&count=15", part: "algorithmic" });
      add({ title: "Mixed practice: Maths — 10 questions", kind: "practice", minutes: 30, href: "/practice?part=math&count=10", part: "math" });
      add({ title: "Weakest-topic drill (12 questions from your weakest tags)", kind: "drill", minutes: 30, href: "/practice?mode=weakest&count=12" });
      add({ title: "Weakest-topic drill (12 questions)", kind: "drill", minutes: 30, href: "/practice?mode=weakest&count=12" });
      add({ title: "Review queue (error log)", kind: "review", minutes: 30, href: "/review" });
      if (wInPhase === 1) {
        const d = studyDays[Math.min(4, studyDays.length - 2)];
        pin(d, { title: "Full mock 1 under exam rules (all three sections)", kind: "mock", minutes: 165, href: "/mock?start=mock-1" });
        pin(addDaysIso(d, 1), { title: "Review full mock 1: every wrong answer + linked resources", kind: "mock-review", minutes: 60, href: "/mock" });
        checkpoint = { text: "Complete full mock 1 under exam rules (target ≥ 55%).", metric: { kind: "mock", target: 55 } };
      } else if (wInPhase === 2) {
        const d = studyDays[Math.min(3, studyDays.length - 2)];
        pin(d, { title: "Generated CST mock (Maths + SR&LT) under exam rules", kind: "mock", minutes: 105, href: "/mock?generate=cst" });
        pin(addDaysIso(d, 1), { title: "Review the CST mock", kind: "mock-review", minutes: 45, href: "/mock" });
        add({ title: "Proctoring & equipment readiness check: webcam, microphone, stable internet, quiet room, ID, power, no second screen", kind: "readiness", minutes: 30, href: "/exams" });
        checkpoint = { text: "Generated CST mock ≥ 60%, and the readiness checklist is done.", metric: { kind: "mock", target: 60 } };
      } else {
        checkpoint = { text: "Answer at least 60 mixed questions this week with 70%+ accuracy.", metric: { kind: "practice", count: 60, accuracy: 70 } };
      }
    } else {
      // P4 — one full mock per week under exam rules, review the next day, drills, taper.
      const t = testsThisWeek[0];
      const preTaper = newMaterialDays;
      if (t?.id === "delft-cst") {
        for (const d of studyDays.filter((d) => taperDays.has(d) && d < t.date)) pin(d, { title: "Taper: formula sheet + error-log review only (no new material)", kind: "taper", minutes: 40, href: "/review" });
        pin(t.date, { title: `${t.label} — test day (${t.status})`, kind: "test-day", minutes: 105, href: "/exams" });
        const after = studyDays.filter((d) => d > t.date);
        if (after[0]) pin(after[0], { title: "Rest after the CST, then a short algorithmic warm-up", kind: "warmup", minutes: 20, href: "/practice?part=algorithmic&count=5", part: "algorithmic" });
        if (after[1]) pin(after[1], { title: "Algorithmic drill for TU/e (15 questions)", kind: "drill", minutes: 40, href: "/practice?part=algorithmic&count=15", part: "algorithmic" });
        checkpoint = { text: "Sit the TU Delft CST.", metric: { kind: "none" } };
      } else if (t?.id === "tue-selection") {
        for (const d of preTaper.filter((d) => d < t.date)) pin(d, { title: "Targeted drill: weakest tags (algorithmic + logic)", kind: "drill", minutes: 50, href: "/practice?mode=weakest&count=15" });
        for (const d of studyDays.filter((d) => taperDays.has(d) && d < t.date)) pin(d, { title: "Taper: error-log review only (no new material)", kind: "taper", minutes: 40, href: "/review" });
        pin(t.date, { title: `${t.label} — test day (${t.status})`, kind: "test-day", minutes: 240, href: "/exams" });
        checkpoint = { text: "Sit the TU/e selection tests.", metric: { kind: "none" } };
      } else {
        const wInPhase = starts.filter((s) => s >= phase.start && s < start).length;
        const mockTitle = wInPhase === 0 ? "Full mock 2 under exam rules (all three sections)" : wInPhase === 1 ? "Generated CST mock under exam rules" : "Generated TU/e mock under exam rules (3 × 60 min)";
        const href = wInPhase === 0 ? "/mock?start=mock-2" : wInPhase === 1 ? "/mock?generate=cst" : "/mock?generate=tue";
        const minutes = wInPhase === 0 ? 165 : wInPhase === 1 ? 105 : 180;
        const d = preTaper[Math.min(1, preTaper.length - 1)];
        pin(d, { title: mockTitle, kind: "mock", minutes, href });
        pin(addDaysIso(d, 1), { title: "Review yesterday's mock (next-day review)", kind: "mock-review", minutes: 60, href: "/mock" });
        if (start <= "2027-02-09" && end >= "2027-02-09") add({ title: "TU Delft proctoring trial run (window 9–16 Feb) — test your equipment", kind: "readiness", minutes: 30, href: "/exams" });
        add({ title: "Targeted drill: weakest tags", kind: "drill", minutes: 40, href: "/practice?mode=weakest&count=15" });
        add({ title: "Targeted drill: weakest tags", kind: "drill", minutes: 40, href: "/practice?mode=weakest&count=15" });
        add({ title: "Mixed practice: Logic — 15 questions", kind: "practice", minutes: 35, href: "/practice?part=logic&count=15", part: "logic" });
        add({ title: "Mixed practice: Maths — 10 questions", kind: "practice", minutes: 30, href: "/practice?part=math&count=10", part: "math" });
        add({ title: "Review queue (error log)", kind: "review", minutes: 30, href: "/review" });
        checkpoint = { text: "Weekly mock ≥ 65% (or better than last week's).", metric: { kind: "mock", target: 65 } };
      }
    }

    // ------------------------------------------- top up light-filled weeks
    // P0/P3/P4 weeks are built around fixed items; fill the remaining hours with mixed practice in the
    // configured split (logic + algorithmic vs maths), except on taper and test weeks.
    if (!testsThisWeek.length && phase.id !== "P1" && phase.id !== "P2") {
      const sum = () => [...tasks, ...pinned.map((p) => p.task)].reduce((s2, t) => s2 + t.minutes, 0);
      const cycle: { part: PartId; title: string; minutes: number }[] =
        phase.id === "P0"
          ? [
              { part: "logic", title: "Read Foundations of Computation ch. 2 and try the in-text exercises", minutes: 45 },
              { part: "algorithmic", title: "Bebras-style warm-up set: 10 algorithmic puzzles", minutes: 25 },
            ]
          : [
              { part: "logic", title: "Mixed practice: Logic — 15 questions", minutes: 35 },
              { part: "algorithmic", title: "Mixed practice: Algorithmic — 15 questions", minutes: 35 },
              { part: "logic", title: "Timed mixed set: Logic — 12 questions at exam pace", minutes: 27 },
              { part: "algorithmic", title: "Timed mixed set: Algorithmic — 12 questions at exam pace", minutes: 29 },
              { part: "math", title: "Mixed practice: Maths — 10 questions", minutes: 30 },
            ];
      let k = 0;
      let guard = 0;
      while (sum() < budget * 0.9 && guard++ < 30) {
        const c = cycle[k++ % cycle.length];
        if (c.part === "math" && phase.id !== "P0") {
          const mathSoFar = [...tasks, ...pinned.map((p) => p.task)].filter((t) => t.part === "math").reduce((s2, t) => s2 + t.minutes, 0);
          if (mathSoFar > MATH) continue;
        }
        const timed = c.title.startsWith("Timed");
        add({
          prio: 9,
          title: c.title,
          kind: phase.id === "P0" ? (c.part === "logic" ? "resource" : "warmup") : "practice",
          minutes: c.minutes,
          href: phase.id === "P0" && c.part === "logic" ? "/resources" : `/practice?part=${c.part}&count=${c.title.match(/(\d+) /)?.[1] ?? 10}${timed ? "&timed=1" : ""}`,
          part: c.part,
          resourceId: phase.id === "P0" && c.part === "logic" ? "foc-ch2" : undefined,
        });
      }
    }

    // ------------------------------------------- trim to the hour budget
    // Pinned tests, mocks and taper days are never removed; everything else goes lowest priority first.
    const total = () => [...tasks, ...pinned.map((p) => p.task)].reduce((s2, t) => s2 + t.minutes, 0);
    const removable = () => [
      ...tasks.map((t, i) => ({ prio: t.prio ?? 5, drop: () => tasks.splice(i, 1) })),
      ...pinned.map((p, i) => ({ prio: p.task.kind === "warmup" ? p.task.prio ?? 6 : -1, drop: () => pinned.splice(i, 1) })).filter((x) => x.prio >= 0),
    ];
    while (total() > budget * 1.05) {
      const cand = removable().filter((c) => c.prio > 1);
      if (!cand.length) break;
      const worst = cand.reduce((a, b) => (b.prio >= a.prio ? b : a));
      worst.drop();
    }
    if (total() > budget * 1.05) notes.push("This week is over budget because of fixed tests/mocks — treat the rest as optional.");

    // -------------------------------------------------- assign to days
    const load = new Map<string, number>(studyDays.map((d) => [d, 0]));
    for (const p of pinned) load.set(p.date, (load.get(p.date) ?? 0) + p.task.minutes);
    const flexibleDays = newMaterialDays.length ? newMaterialDays : studyDays;
    const placed: { task: Draft; date: string }[] = [...pinned];
    for (const t of tasks) {
      const pool = t.kind === "review" || t.kind === "taper" ? studyDays : flexibleDays;
      if (!pool.length) continue;
      let best = pool[0];
      for (const d of pool) if ((load.get(d) ?? 0) < (load.get(best) ?? 0)) best = d;
      load.set(best, (load.get(best) ?? 0) + t.minutes);
      placed.push({ task: t, date: best });
    }
    const counts = new Map<string, number>();
    const final: Task[] = placed
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ task: { prio: _prio, ...task }, date }) => {
        void _prio;
        const base = `w${String(index).padStart(2, "0")}-${slug(task.kind)}-${slug(task.unit ?? task.part ?? task.resourceId ?? "x")}`;
        const n = (counts.get(base) ?? 0) + 1;
        counts.set(base, n);
        return { ...task, id: `${base}-${n}`, date };
      });

    return { index, start, end, phase, hours, kind, optionalExtra, focus, tasks: final, checkpoint, notes };
  });
}

// --------------------------------------------------------- rescheduling

/** The date a task is shown on, after any manual rescheduling. */
export function effectiveDate(task: Task, overrides: Record<string, string>): string {
  return overrides[task.id] ?? task.date;
}

/**
 * "Reschedule remaining tasks": every unfinished task from the missed week onward moves forward by
 * 7 days (keeping its weekday), but never past the day before the last taper, and never onto the rest day.
 * Test days and taper tasks stay where they are.
 */
export function rescheduleFrom(
  weeks: Week[],
  fromIndex: number,
  done: Record<string, string>,
  overrides: Record<string, string>,
  cfg: ScheduleConfig = scheduleConfig,
): Record<string, string> {
  const lastTest = [...cfg.tests].map((t) => t.date).sort().at(-1)!;
  const cap = addDaysIso(lastTest, -cfg.taperDays - 1);
  const next = { ...overrides };
  for (const w of weeks) {
    if (w.index < fromIndex) continue;
    for (const t of w.tasks) {
      if (done[t.id] || t.kind === "test-day" || t.kind === "taper") continue;
      let d = addDaysIso(effectiveDate(t, overrides), 7);
      if (d > cap) d = cap;
      if (weekday(d) === cfg.restDay) d = addDaysIso(d, -1);
      next[t.id] = d;
    }
  }
  return next;
}

export function allTasks(weeks: Week[]): Task[] {
  return weeks.flatMap((w) => w.tasks);
}

export function weekIndexFor(weeks: Week[], iso: string): number {
  const i = weeks.findIndex((w) => iso >= w.start && iso <= w.end);
  if (i >= 0) return i;
  return iso < weeks[0].start ? 0 : weeks.length - 1;
}

/** Planned minutes up to (and including) a date. */
export function plannedMinutesUntil(weeks: Week[], iso: string, overrides: Record<string, string> = {}): number {
  return allTasks(weeks)
    .filter((t) => t.kind !== "test-day" && effectiveDate(t, overrides) <= iso)
    .reduce((s, t) => s + t.minutes, 0);
}

export const MATH_UNIT_IDS = MATH_UNITS;
