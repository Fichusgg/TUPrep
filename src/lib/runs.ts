/** Starting and grading timed runs (unit tests and mocks). The timer is deadline-based, so it survives reloads. */
import { scheduleConfig } from "@config/schedule.config";
import { BANK, BLUEPRINTS, UNIT_TESTS, WRITTEN_MOCKS, getQuestion } from "@/content";
import type { Question } from "@/content/schema";
import { isCorrect } from "./grading";
import { generateMock } from "./mockgen";
import { createRng, randomSeed } from "./rng";
import { composite, pct } from "./scoring";
import { getState, recordAnswers, saveRunResult, uid, type ActiveRun, type RunResult, type RunSection } from "./store";

const items = (qids: string[]) => qids.map((qid) => ({ qid, response: null, ms: 0, flagged: false, visited: false }));

function seenIds(): Set<string> {
  return new Set(getState().attempts.map((a) => a.qid));
}

/** Pick a unit test from the unit's bank following the difficulty mix; prefers unseen questions. */
export function createUnitTest(unit: string, opts: { count?: number; noGoingBack?: boolean; seed?: number } = {}): ActiveRun {
  const def = UNIT_TESTS.find((t) => t.unit === unit)!;
  const count = opts.count ?? def.count;
  const rng = createRng(opts.seed ?? randomSeed());
  const seen = seenIds();
  const pool = rng.shuffle(BANK.filter((q) => q.unit === unit));
  const want = [0, 1, 2].map((i) => Math.round(def.difficultyMix[i] * count));
  while (want.reduce((a, b) => a + b, 0) > count) want[1]--;
  while (want.reduce((a, b) => a + b, 0) < count) want[1]++;
  const chosen: Question[] = [];
  for (const d of [1, 2, 3] as const) {
    const fresh = pool.filter((q) => q.difficulty === d && !seen.has(q.id) && !chosen.includes(q));
    const stale = pool.filter((q) => q.difficulty === d && seen.has(q.id) && !chosen.includes(q));
    chosen.push(...[...fresh, ...stale].slice(0, want[d - 1]));
  }
  for (const q of pool) if (chosen.length < count && !chosen.includes(q)) chosen.push(q);
  chosen.sort((a, b) => a.difficulty - b.difficulty);
  const part = chosen[0]?.unit.startsWith("L") ? "logic" : chosen[0]?.unit.startsWith("A") ? "algorithmic" : "math";
  const seconds = count * scheduleConfig.pace[part];
  return {
    id: `unit-${unit}-${uid()}`,
    kind: "unit-test",
    title: def.title,
    unit,
    noGoingBack: opts.noGoingBack ?? def.noGoingBackDefault,
    startedAt: Date.now(),
    sections: [{ part, title: def.title, minutes: Math.round(seconds / 60), items: items(chosen.map((q) => q.id)), startedAt: null, deadline: null, finishedAt: null }],
    sectionIndex: 0,
    current: 0,
    enteredAt: null,
    onBreak: false,
  };
}

/** A fully written mock taken in CST format (Maths 60 min + SR&LT 45 min) or TU/e format (3 × 60 min). */
export function createWrittenMock(mockId: string, format: "cst" | "tue"): ActiveRun {
  const m = WRITTEN_MOCKS.find((x) => x.id === mockId)!;
  const bp = BLUEPRINTS.find((b) => b.id === format)!;
  const sections: RunSection[] = m.sections
    .filter((s) => bp.sections.some((b) => b.part === s.part))
    .map((s) => ({ part: s.part, title: bp.sections.find((b) => b.part === s.part)!.title, minutes: bp.sections.find((b) => b.part === s.part)!.minutes, items: items(s.questions.map((q) => q.id)), startedAt: null, deadline: null, finishedAt: null }));
  return { id: `${mockId}-${format}-${uid()}`, kind: "mock", title: `${m.title} — ${format === "cst" ? "TU Delft CST format" : "TU/e format"}`, format, source: mockId, noGoingBack: true, startedAt: Date.now(), sections, sectionIndex: 0, current: 0, enteredAt: null, onBreak: false };
}

/** Generate a new mock from the banks (blueprint mix), excluding questions already answered. */
export function createGeneratedMock(format: "cst" | "tue", seed = randomSeed()): { run: ActiveRun; repeats: number } {
  const bp = BLUEPRINTS.find((b) => b.id === format)!;
  const { sections, repeats } = generateMock(bp, BANK, { exclude: seenIds(), seed });
  const run: ActiveRun = {
    id: `gen-${format}-${uid()}`,
    kind: "mock",
    title: `Generated ${format === "cst" ? "TU Delft CST" : "TU/e"} mock`,
    format,
    source: "generated",
    noGoingBack: true,
    startedAt: Date.now(),
    sections: sections.map((s) => ({ part: s.part, title: s.title, minutes: s.minutes, items: items(s.qids), startedAt: null, deadline: null, finishedAt: null })),
    sectionIndex: 0,
    current: 0,
    enteredAt: null,
    onBreak: false,
  };
  return { run, repeats };
}

/** Grade, record every answer (so misses enter the error log), and store the result. */
export function finishRun(run: ActiveRun, now = Date.now()): RunResult {
  const sections = run.sections.map((s) => {
    const correct = s.items.filter((it) => {
      const q = getQuestion(it.qid);
      return q ? isCorrect(q, it.response) : false;
    }).length;
    return { ...s, finishedAt: s.finishedAt ?? now, correct, total: s.items.length };
  });
  const answers = run.sections.flatMap((s) =>
    s.items.flatMap((it) => {
      const q = getQuestion(it.qid);
      return q ? [{ q, correct: isCorrect(q, it.response), ms: it.ms, mode: run.kind === "mock" ? ("mock" as const) : ("test" as const) }] : [];
    }),
  );
  recordAnswers(answers, now);
  const score =
    run.kind === "mock" && run.format
      ? composite(run.format, sections.map((s) => ({ part: s.part, correct: s.correct, total: s.total })), getState().settings.vwoAverage)
      : pct(sections.reduce((a, s) => a + s.correct, 0), sections.reduce((a, s) => a + s.total, 0));
  const result: RunResult = {
    id: run.id,
    kind: run.kind,
    title: run.title,
    unit: run.unit,
    format: run.format,
    source: run.source,
    noGoingBack: run.noGoingBack,
    startedAt: run.startedAt,
    finishedAt: now,
    sections,
    score,
  };
  saveRunResult(result);
  return result;
}
