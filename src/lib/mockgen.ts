/**
 * Builds mocks from the question banks according to a blueprint (unit mix + difficulty mix), avoiding
 * questions you have already seen. Shared by the app ("Generate a new mock") and `npm run mocks:generate`.
 */
import type { Blueprint, Question } from "@/content/schema";
import { createRng } from "./rng";

export interface GeneratedSection {
  part: Blueprint["sections"][number]["part"];
  title: string;
  minutes: number;
  qids: string[];
}

/** Largest-remainder apportionment of `total` over the given weights. */
export function apportion(weights: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(weights);
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  const raw = keys.map((k) => ({ k, x: (weights[k] / sum) * total }));
  const out: Record<string, number> = Object.fromEntries(raw.map(({ k, x }) => [k, Math.floor(x)]));
  let left = total - Object.values(out).reduce((s, v) => s + v, 0);
  for (const { k } of [...raw].sort((a, b) => (b.x % 1) - (a.x % 1))) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  return out;
}

export function generateMock(
  blueprint: Blueprint,
  bank: Question[],
  opts: { exclude?: Set<string>; seed: number },
): { sections: GeneratedSection[]; repeats: number } {
  const rng = createRng(opts.seed);
  const exclude = opts.exclude ?? new Set<string>();
  let repeats = 0;
  const used = new Set<string>();

  const sections = blueprint.sections.map((sec) => {
    const perUnit = apportion(sec.units, sec.count);
    const qids: string[] = [];
    for (const [unit, n] of Object.entries(perUnit)) {
      if (n === 0) continue;
      const pool = rng.shuffle(bank.filter((q) => q.unit === unit && !used.has(q.id)));
      const want = apportion({ 1: sec.difficultyMix[0], 2: sec.difficultyMix[1], 3: sec.difficultyMix[2] }, n);
      const pick = (pred: (q: Question) => boolean): Question | undefined => {
        const i = pool.findIndex(pred);
        return i >= 0 ? pool.splice(i, 1)[0] : undefined;
      };
      for (const d of [1, 2, 3] as const) {
        for (let k = 0; k < want[d]; k++) {
          const q =
            pick((x) => x.difficulty === d && !exclude.has(x.id)) ??
            pick((x) => !exclude.has(x.id)) ??
            pick((x) => x.difficulty === d) ??
            pick(() => true);
          if (!q) continue;
          if (exclude.has(q.id)) repeats++;
          used.add(q.id);
          qids.push(q.id);
        }
      }
    }
    // Present easier questions first within a section, like most tests.
    const diff = new Map(bank.map((q) => [q.id, q.difficulty]));
    qids.sort((a, b) => (diff.get(a)! - diff.get(b)!) || 0);
    return { part: sec.part, title: sec.title, minutes: sec.minutes, qids };
  });
  return { sections, repeats };
}
