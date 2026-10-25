import { scheduleConfig } from "@config/schedule.config";
import { bankForUnit, UNITS } from "@/content";
import type { PartId, Unit } from "@/content/schema";
import type { AppData } from "./store";

export type UnitStatus = "not-started" | "in-progress" | "passed";

/** Recommended study order: the order units are introduced in the schedule phases, then anything left. */
export const STUDY_ORDER: string[] = (() => {
  const fromPhases = scheduleConfig.phases.flatMap((p) => p.units as readonly string[]);
  return [...fromPhases, ...UNITS.map((u) => u.id).filter((id) => !fromPhases.includes(id))];
})();

export const PASS_MARK = 70;

export interface UnitProgress {
  unit: Unit;
  status: UnitStatus;
  seen: number;
  total: number;
  accuracy: number | null;
  bestTest: number | null;
  openErrors: number;
}

export function unitProgress(state: Pick<AppData, "attempts" | "runs" | "errors">, unit: Unit): UnitProgress {
  const attempts = state.attempts.filter((a) => a.unit === unit.id);
  const seen = new Set(attempts.map((a) => a.qid)).size;
  const tests = state.runs.filter((r) => r.kind === "unit-test" && r.unit === unit.id).map((r) => r.score);
  const bestTest = tests.length ? Math.max(...tests) : null;
  const status: UnitStatus = bestTest !== null && bestTest >= PASS_MARK ? "passed" : attempts.length ? "in-progress" : "not-started";
  return {
    unit,
    status,
    seen,
    total: bankForUnit(unit.id).length,
    accuracy: attempts.length ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100) : null,
    bestTest,
    openErrors: Object.values(state.errors).filter((e) => e.unit === unit.id && !e.resolved).length,
  };
}

export function orderedUnits(part?: PartId): Unit[] {
  return STUDY_ORDER.map((id) => UNITS.find((u) => u.id === id)!).filter((u) => !part || u.part === part);
}

/** The unit to continue with in a part: first in study order that is not passed. */
export function nextUnit(state: Pick<AppData, "attempts" | "runs" | "errors">, part: PartId): Unit | null {
  return orderedUnits(part).find((u) => unitProgress(state, u).status !== "passed") ?? null;
}

export const STATUS_LABEL: Record<UnitStatus, string> = { "not-started": "Not started", "in-progress": "In progress", passed: "Test passed" };
