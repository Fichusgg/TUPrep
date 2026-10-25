import type { Week } from "./schedule";
import { isoToUtc } from "./schedule";
import type { Attempt, RunResult } from "./store";

export type CheckpointState = { status: "met" | "not-met" | "pending" | "manual"; detail: string };

/** Evaluate a week's measurable checkpoint against the data recorded during that week. */
export function evaluateCheckpoint(w: Week, attempts: Attempt[], runs: RunResult[], todayIso: string): CheckpointState {
  const from = isoToUtc(w.start) - 14 * 3600_000; // local-time slack
  const to = isoToUtc(w.end) + 38 * 3600_000;
  const inWeek = (t: number) => t >= from && t <= to;
  const over = todayIso > w.end;
  const m = w.checkpoint.metric;
  switch (m.kind) {
    case "none":
      return { status: "manual", detail: "Tick it off yourself." };
    case "unit-test": {
      const best = Math.max(-1, ...runs.filter((r) => r.kind === "unit-test" && r.unit === m.unit && inWeek(r.finishedAt)).map((r) => r.score));
      if (best >= m.target) return { status: "met", detail: `Best ${m.unit} test this week: ${best}%` };
      return { status: over ? "not-met" : "pending", detail: best >= 0 ? `Best so far ${best}% (target ${m.target}%)` : "No attempt yet this week" };
    }
    case "practice": {
      const list = attempts.filter((a) => inWeek(a.at) && (!m.part || a.part === m.part));
      const acc = list.length ? Math.round((list.filter((a) => a.correct).length / list.length) * 100) : 0;
      if (list.length >= m.count && acc >= m.accuracy) return { status: "met", detail: `${list.length} answered, ${acc}% correct` };
      return { status: over ? "not-met" : "pending", detail: `${list.length}/${m.count} answered${m.accuracy ? `, ${acc}% (target ${m.accuracy}%)` : ""}` };
    }
    case "mock": {
      const list = runs.filter((r) => r.kind === "mock" && inWeek(r.finishedAt));
      const best = Math.max(-1, ...list.map((r) => r.score));
      if (best >= m.target) return { status: "met", detail: `Best mock this week: ${best}%` };
      return { status: over ? "not-met" : "pending", detail: best >= 0 ? `Best so far ${best}% (target ${m.target}%)` : "No mock taken yet this week" };
    }
  }
}
