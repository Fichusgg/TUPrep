/**
 * Error log + spaced review. Every missed question enters the log; the review queue resurfaces it
 * 1, 3, 7 and 21 days later. A correct review moves it to the next interval; after the 21-day review
 * it is resolved. A wrong review resets it to the 1-day interval.
 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 21] as const;
export type ErrorType = "concept" | "misread" | "time" | "careless";
export const ERROR_TYPES: { id: ErrorType; label: string; help: string }[] = [
  { id: "concept", label: "Concept", help: "I did not know or misunderstood the idea." },
  { id: "misread", label: "Misread", help: "I read the question or a symbol wrongly." },
  { id: "time", label: "Time", help: "I ran out of time or rushed." },
  { id: "careless", label: "Careless", help: "Arithmetic slip or clicking the wrong option." },
];

export interface ErrorEntry {
  qid: string;
  unit: string;
  firstMissed: number;
  lastMissed: number;
  misses: number;
  /** Index into REVIEW_INTERVAL_DAYS of the *next* review. */
  stage: number;
  due: number;
  resolved: boolean;
  errorType?: ErrorType;
  note?: string;
  source: "auto" | "manual";
}

const DAY = 86_400_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(t: number, days: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function logMiss(prev: ErrorEntry | undefined, qid: string, unit: string, now: number, source: "auto" | "manual" = "auto"): ErrorEntry {
  if (!prev) {
    return { qid, unit, firstMissed: now, lastMissed: now, misses: 1, stage: 0, due: addDays(now, REVIEW_INTERVAL_DAYS[0]), resolved: false, source };
  }
  return { ...prev, lastMissed: now, misses: prev.misses + 1, stage: 0, due: addDays(now, REVIEW_INTERVAL_DAYS[0]), resolved: false };
}

/** Apply the result of a review attempt. */
export function applyReview(e: ErrorEntry, correct: boolean, now: number): ErrorEntry {
  if (!correct) return logMiss(e, e.qid, e.unit, now);
  const stage = e.stage + 1;
  if (stage >= REVIEW_INTERVAL_DAYS.length) return { ...e, stage, resolved: true, due: Infinity };
  return { ...e, stage, due: addDays(now, REVIEW_INTERVAL_DAYS[stage]) };
}

export function isDue(e: ErrorEntry, now: number): boolean {
  return !e.resolved && e.due <= now;
}

export { DAY };
