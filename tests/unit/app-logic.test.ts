import { describe, expect, it } from "vitest";
import { scheduleConfig } from "@config/schedule.config";
import { BANK, BLUEPRINTS, UNITS, WRITTEN_MOCKS, getQuestion } from "@/content";
import type { Question } from "@/content/schema";
import { isCorrect, normaliseText, parseNumber } from "@/lib/grading";
import { apportion, generateMock } from "@/lib/mockgen";
import { addDaysIso, apStatus, buildSchedule, rescheduleFrom, weekday } from "@/lib/schedule";
import { composite, readiness } from "@/lib/scoring";
import { applyReview, logMiss, REVIEW_INTERVAL_DAYS, startOfDay } from "@/lib/srs";
import { normalize } from "@/lib/store";

describe("content index", () => {
  it("loads all banks and mocks", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(415);
    expect(WRITTEN_MOCKS).toHaveLength(2);
    for (const u of UNITS) expect(BANK.filter((q) => q.unit === u.id).length).toBeGreaterThanOrEqual(u.part === "math" ? 20 : 25);
    expect(getQuestion("L1-001")?.unit).toBe("L1");
    expect(getQuestion("MK2-A20")?.unit).toBe("A6");
  });
});

describe("grading", () => {
  const base = { unit: "M1", tags: ["t"], difficulty: 1 as const, prompt: "p prompt", hint: "hint h", explanation: "explained", estSeconds: 30, source: "original" as const, verified: "manual" as const };
  it("handles every question type", () => {
    const mc: Question = { ...base, id: "X-1", type: "mc", options: ["a", "b"], answer: 1 };
    const multi: Question = { ...base, id: "X-2", type: "multi", options: ["a", "b", "c"], answer: [0, 2] };
    const order: Question = { ...base, id: "X-3", type: "order", options: ["a", "b", "c"], answer: [2, 0, 1] };
    const num: Question = { ...base, id: "X-4", type: "short", answer: { kind: "numeric", value: 32 / 3, tolerance: 1e-6 } };
    const txt: Question = { ...base, id: "X-5", type: "short", answer: { kind: "text", accepted: ["¬p"] } };
    expect(isCorrect(mc, 1)).toBe(true);
    expect(isCorrect(mc, 0)).toBe(false);
    expect(isCorrect(multi, [2, 0])).toBe(true);
    expect(isCorrect(multi, [0])).toBe(false);
    expect(isCorrect(order, [2, 0, 1])).toBe(true);
    expect(isCorrect(order, [0, 1, 2])).toBe(false);
    expect(isCorrect(num, "32/3")).toBe(true);
    expect(isCorrect(num, "10.67")).toBe(false);
    expect(isCorrect(txt, "not p")).toBe(true);
    expect(isCorrect(txt, "~p")).toBe(true);
    expect(isCorrect(txt, null)).toBe(false);
  });
  it("parses numbers and normalises text", () => {
    expect(parseNumber("−3,5")).toBe(-3.5);
    expect(parseNumber("7/2")).toBe(3.5);
    expect(parseNumber("x")).toBeNull();
    expect(normaliseText("  FDW ")).toBe("fdw");
  });
  it("accepts every answer key of the bank", () => {
    for (const q of [...BANK, ...WRITTEN_MOCKS.flatMap((m) => m.sections.flatMap((s) => s.questions))]) {
      const r = q.type === "short" ? (q.answer.kind === "numeric" ? String(q.answer.value) : q.answer.accepted[0]) : q.answer;
      expect(isCorrect(q, r), q.id).toBe(true);
    }
  });
});

describe("spaced review", () => {
  it("resurfaces after 1, 3, 7 and 21 days, then resolves", () => {
    const now = new Date(2026, 10, 2, 15).getTime();
    let e = logMiss(undefined, "L1-001", "L1", now);
    expect(e.due).toBe(startOfDay(now) + 86_400_000);
    const gaps: number[] = [];
    let t = now;
    for (let i = 0; i < REVIEW_INTERVAL_DAYS.length; i++) {
      t = e.due;
      const next = applyReview(e, true, t);
      if (!next.resolved) gaps.push(Math.round((next.due - startOfDay(t)) / 86_400_000));
      e = next;
    }
    expect(gaps).toEqual([3, 7, 21]);
    expect(e.resolved).toBe(true);
    const back = applyReview({ ...e, resolved: false, stage: 2 }, false, t);
    expect(back.stage).toBe(0);
  });
});

describe("schedule", () => {
  const weeks = buildSchedule();
  it("runs from 26 Oct 2026 to the last test, Monday to Sunday", () => {
    expect(weeks[0].start).toBe("2026-10-26");
    expect(weekday(weeks[0].start)).toBe(1);
    const last = [...scheduleConfig.tests].map((t) => t.date).sort().at(-1)!;
    expect(weeks.at(-1)!.start <= last && weeks.at(-1)!.end >= last).toBe(true);
  });
  it("keeps the rest day free and every week has a checkpoint", () => {
    for (const w of weeks) {
      expect(w.tasks.every((t) => weekday(t.date) !== scheduleConfig.restDay)).toBe(true);
      expect(w.checkpoint.text.length).toBeGreaterThan(5);
    }
  });
  it("schedules every unit's timed test and no new material during the taper", () => {
    const all = weeks.flatMap((w) => w.tasks);
    for (const u of UNITS) expect(all.some((t) => t.kind === "timed-test" && t.unit === u.id), u.id).toBe(true);
    for (const t of scheduleConfig.tests) {
      for (let k = 1; k <= scheduleConfig.taperDays; k++) {
        const d = addDaysIso(t.date, -k);
        expect(all.filter((x) => x.date === d).every((x) => ["taper", "review"].includes(x.kind)), d).toBe(true);
      }
      expect(all.some((x) => x.kind === "test-day" && x.date === t.date)).toBe(true);
    }
  });
  it("stays close to the hour budget", () => {
    for (const w of weeks) {
      const minutes = w.tasks.filter((t) => t.kind !== "test-day").reduce((s, t) => s + t.minutes, 0);
      expect(minutes, `week ${w.index}`).toBeLessThanOrEqual(w.hours * 60 * 1.1);
    }
  });
  it("has unique task ids", () => {
    const ids = weeks.flatMap((w) => w.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("reschedules unfinished tasks one week forward", () => {
    const w = weeks[5];
    const doneId = w.tasks[0].id;
    const ov = rescheduleFrom(weeks, 5, { [doneId]: "x" }, {});
    expect(ov[doneId]).toBeUndefined();
    const moved = w.tasks[1];
    expect(ov[moved.id]).toBe(addDaysIso(moved.date, 7));
    expect(Object.values(ov).every((d) => weekday(d) !== scheduleConfig.restDay)).toBe(true);
  });
  it("labels AP coverage", () => {
    expect(apStatus("M3", "2026-11-01")?.label).toMatch(/Covered/);
    expect(apStatus("M5", "2026-11-20")?.label).toMatch(/by 2026-12-14/);
    expect(apStatus("M7", "2027-01-01")?.label).toBe("Pre-learn needed");
  });
});

describe("mock generator", () => {
  it("apportions counts exactly", () => {
    const a = apportion({ a: 1, b: 1, c: 1 }, 10);
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(10);
  });
  it("follows the blueprint and avoids seen questions", () => {
    const bp = BLUEPRINTS.find((b) => b.id === "tue")!;
    const seen = new Set(BANK.filter((q) => q.unit === "L5").slice(0, 10).map((q) => q.id));
    const { sections, repeats } = generateMock(bp, BANK, { exclude: seen, seed: 7 });
    expect(sections.map((s) => s.qids.length)).toEqual(bp.sections.map((s) => s.count));
    const ids = sections.flatMap((s) => s.qids);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => seen.has(id))).toHaveLength(repeats);
    expect(repeats).toBe(0);
    for (const s of sections) for (const id of s.qids) expect(getQuestion(id)!.unit in bp.sections.find((x) => x.part === s.part)!.units).toBe(true);
  });
  it("is deterministic for a seed", () => {
    const bp = BLUEPRINTS.find((b) => b.id === "cst")!;
    expect(generateMock(bp, BANK, { seed: 3 })).toEqual(generateMock(bp, BANK, { seed: 3 }));
  });
});

describe("scoring", () => {
  it("weights CST 50/50 and TU/e 10/40/40", () => {
    const parts = [
      { part: "math" as const, correct: 10, total: 10 },
      { part: "logic" as const, correct: 0, total: 10 },
      { part: "algorithmic" as const, correct: 5, total: 10 },
    ];
    expect(composite("cst", parts)).toBe(50);
    expect(composite("tue", parts)).toBe(Math.round(((10 * 100 + 40 * 0 + 40 * 50) / 90) * 10) / 10);
    expect(readiness([40, 85, 90, 95])?.label).toBe("Ready");
    expect(readiness([])).toBeNull();
  });
});

describe("store normalisation", () => {
  it("rejects foreign data and fills defaults", () => {
    expect(() => normalize({ version: 1 })).toThrow();
    const s = normalize({ version: 2, attempts: [{ qid: "L1-001" }, null], settings: { dailyGoal: 5 } });
    expect(s.attempts).toHaveLength(1);
    expect(s.settings.dailyGoal).toBe(5);
    expect(s.settings.theme).toBe("system");
  });
});
