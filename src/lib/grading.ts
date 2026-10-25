import type { Question } from "@/content/schema";

/** A student's answer: mc → option index, multi/order → indices, short → raw text. */
export type Response = number | number[] | string | null;

/** Parse numeric input: "−3", "3,5", "7/2", "-1.25", " 12 ". Exact fractions stay exact enough for tolerance checks. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/[−–]/g, "-").replace(/\s+/g, "").replace(",", ".");
  if (s === "") return null;
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Normalisation rules for text answers: trim, collapse spaces, unify minus signs and logic symbols, optional case/space folding. */
export function normaliseText(s: string, opts: { caseSensitive?: boolean; ignoreSpaces?: boolean } = {}): string {
  let t = s.trim().replace(/[−–]/g, "-").replace(/\s+/g, " ");
  t = t.replace(/~|!/g, "¬").replace(/\bnot\s*/gi, "¬").replace(/¬\s+/g, "¬");
  if (!opts.caseSensitive) t = t.toLowerCase();
  if (opts.ignoreSpaces) t = t.replace(/ /g, "");
  return t;
}

export function isAnswered(r: Response): boolean {
  if (r === null) return false;
  if (typeof r === "string") return r.trim() !== "";
  if (Array.isArray(r)) return r.length > 0;
  return true;
}

export function isCorrect(q: Question, r: Response): boolean {
  if (!isAnswered(r)) return false;
  switch (q.type) {
    case "mc":
      return r === q.answer;
    case "multi": {
      if (!Array.isArray(r)) return false;
      const a = [...new Set(r)].sort((x, y) => x - y);
      const b = [...q.answer].sort((x, y) => x - y);
      return a.length === b.length && a.every((x, i) => x === b[i]);
    }
    case "order":
      return Array.isArray(r) && r.length === q.answer.length && r.every((x, i) => x === q.answer[i]);
    case "short": {
      if (typeof r !== "string") return false;
      if (q.answer.kind === "numeric") {
        const v = parseNumber(r);
        if (v === null) return false;
        const tol = q.answer.tolerance ?? 1e-9 * Math.max(1, Math.abs(q.answer.value));
        return Math.abs(v - q.answer.value) <= tol;
      }
      const ans = q.answer;
      const got = normaliseText(r, ans);
      return ans.accepted.some((a) => normaliseText(a, ans) === got);
    }
  }
}

function fmtNum(n: number): string {
  const r = Math.round(n * 1e6) / 1e6;
  return String(r).replace("-", "−");
}

export function formatAnswer(q: Question): string {
  switch (q.type) {
    case "mc":
      return q.options[q.answer];
    case "multi":
      return q.answer.map((i) => q.options[i]).join("; ");
    case "order":
      return q.answer.map((i) => q.options[i]).join(" → ");
    case "short":
      return q.answer.kind === "numeric"
        ? `${fmtNum(q.answer.value)}${q.unitLabel ? ` ${q.unitLabel}` : ""}`
        : q.answer.accepted[0];
  }
}

export function formatResponse(q: Question, r: Response): string {
  if (!isAnswered(r)) return "— (no answer)";
  if (q.type === "short") return String(r);
  if (q.type === "mc") return typeof r === "number" ? q.options[r] ?? "?" : "?";
  if (!Array.isArray(r)) return "?";
  return r.map((i) => q.options[i]).join(q.type === "order" ? " → " : "; ");
}
