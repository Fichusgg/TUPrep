import { BLUEPRINTS } from "@/content";
import type { PartId } from "@/content/schema";

export interface PartScore {
  part: PartId;
  correct: number;
  total: number;
}

export const pct = (c: number, t: number) => (t === 0 ? 0 : Math.round((c / t) * 1000) / 10);

/**
 * Composite with the weights of the chosen format (CST 50/50; TU/e 10/40/40, renormalised over the
 * tests — the VWO grade is added only when entered in Settings).
 */
export function composite(format: "cst" | "tue", parts: PartScore[], vwoAverage?: number | null): number {
  const bp = BLUEPRINTS.find((b) => b.id === format)!;
  let w = 0;
  let s = 0;
  for (const p of parts) {
    const weight = bp.weights[p.part];
    if (weight === undefined) continue;
    w += weight;
    s += weight * pct(p.correct, p.total);
  }
  if (format === "tue" && vwoAverage != null && vwoAverage >= 1 && vwoAverage <= 10) {
    s += 10 * vwoAverage * 10;
    w += 10;
  }
  return w === 0 ? 0 : Math.round((s / w) * 10) / 10;
}

export interface Readiness {
  label: string;
  tone: "bad" | "warn" | "info" | "good";
  explain: string;
}

/**
 * Readiness heuristic (ours, not official): average of the last three mock scores of a format.
 * Neither university publishes pass marks; the Delft lottery categories and TU/e ranking depend on the pool.
 */
export function readiness(scores: number[]): Readiness | null {
  if (!scores.length) return null;
  const recent = scores.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const n = `average of your last ${recent.length} mock${recent.length > 1 ? "s" : ""}: ${Math.round(avg)}%`;
  if (avg >= 80) return { label: "Ready", tone: "good", explain: `${n}. Keep the rhythm and taper before the test.` };
  if (avg >= 65) return { label: "On track", tone: "info", explain: `${n}. Target your weakest tags to push past 80%.` };
  if (avg >= 50) return { label: "Getting there", tone: "warn", explain: `${n}. Focus on the units with the lowest accuracy.` };
  return { label: "Not ready yet", tone: "bad", explain: `${n}. Rebuild foundations in your weakest units before the next mock.` };
}
