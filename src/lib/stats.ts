import { UNITS } from "@/content";
import type { PartId } from "@/content/schema";
import type { Attempt } from "./store";
import { startOfDay } from "./srs";

export interface Tally {
  attempts: number;
  correct: number;
  accuracy: number;
  avgMs: number;
}

export function tally(list: Attempt[]): Tally {
  const correct = list.filter((a) => a.correct).length;
  return {
    attempts: list.length,
    correct,
    accuracy: list.length ? Math.round((correct / list.length) * 100) : 0,
    avgMs: list.length ? Math.round(list.reduce((s, a) => s + a.ms, 0) / list.length) : 0,
  };
}

export const byPart = (a: Attempt[], part: PartId) => tally(a.filter((x) => x.part === part));
export const byUnit = (a: Attempt[], unit: string) => tally(a.filter((x) => x.unit === unit));

export function unitTable(attempts: Attempt[]) {
  return UNITS.map((u) => ({ unit: u, ...byUnit(attempts, u.id) }));
}

/** Weakest topic tags with at least `min` attempts, lowest accuracy first. */
export function weakestTags(attempts: Attempt[], min = 3, n = 8) {
  const map = new Map<string, Attempt[]>();
  for (const a of attempts) for (const t of a.tags) map.set(t, [...(map.get(t) ?? []), a]);
  return [...map.entries()]
    .map(([tag, list]) => ({ tag, ...tally(list), units: [...new Set(list.map((x) => x.unit))] }))
    .filter((x) => x.attempts >= min)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, n);
}

export function streak(attempts: Attempt[], extraDays: number[] = [], now = Date.now()): number {
  const days = new Set([...attempts.map((a) => startOfDay(a.at)), ...extraDays.map(startOfDay)]);
  let d = startOfDay(now);
  if (!days.has(d)) d = startOfDay(d - 43_200_000);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = startOfDay(d - 43_200_000);
  }
  return n;
}

export function minutesOnSite(attempts: Attempt[], since = 0): number {
  return Math.round(attempts.filter((a) => a.at >= since).reduce((s, a) => s + a.ms, 0) / 60000);
}
