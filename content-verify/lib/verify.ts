import type { Question, Verifier } from "../../src/content/schema";
import * as h from "./helpers";
import * as logic from "./logic";
import { run, show, type Value } from "./pseudocode";

export type VerifyStatus = "verified" | "failed" | "manual" | "missing";
export interface VerifyResult {
  id: string;
  status: VerifyStatus;
  method: string;
  detail: string;
}

/** What a verifier produced. */
type Outcome =
  | { kind: "value"; value: unknown }
  | { kind: "index"; index: number }
  | { kind: "indices"; indices: number[] }
  | { kind: "order"; order: number[] };

// ----------------------------------------------------------- normalisation

export function parseNum(s: unknown): number | null {
  if (typeof s === "number") return s;
  if (typeof s !== "string") return null;
  const t = s.trim().replace(/[−–]/g, "-").replace(/\$/g, "").replace(/\s+/g, "");
  const fr = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (fr) return Number(fr[1]) / Number(fr[2]);
  const tex = /^(-?)\\[dt]?frac\{(-?\d+)\}\{(\d+)\}$/.exec(t);
  if (tex) return (tex[1] ? -1 : 1) * (Number(tex[2]) / Number(tex[3]));
  if (/^-?(\d+(\.\d*)?|\.\d+)$/.test(t)) return Number(t);
  return null;
}

export function normText(s: string, opts: { caseSensitive?: boolean; ignoreSpaces?: boolean } = {}): string {
  let t = s.trim().replace(/[−–]/g, "-").replace(/\s+/g, " ");
  if (!opts.caseSensitive) t = t.toLowerCase();
  if (opts.ignoreSpaces) t = t.replace(/ /g, "");
  return t;
}

function valueToString(v: unknown): string {
  if (Array.isArray(v) || typeof v === "number" || typeof v === "boolean" || v === null) return show(v as Value);
  return String(v);
}

/** Does a computed value match an option label / option value? */
function matches(value: unknown, option: string | number): boolean {
  const a = typeof value === "number" ? value : parseNum(value);
  const b = parseNum(option);
  if (a !== null && b !== null) return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  if (Array.isArray(value) && typeof option === "string") {
    const asList = option.trim().replace(/^\[|\]$/g, "");
    return normText(value.map((x) => valueToString(x)).join(", "), { ignoreSpaces: true }) === normText(asList, { ignoreSpaces: true });
  }
  return normText(valueToString(value), { ignoreSpaces: true }) === normText(String(option), { ignoreSpaces: true });
}

// --------------------------------------------------------------- runners

function runVerifier(q: Question, v: Verifier): Outcome {
  switch (v.kind) {
    case "pseudocode": {
      const code = v.code ?? q.code;
      if (!code) throw new Error("pseudocode verifier but no code");
      const r = run(code);
      if (typeof v.result === "object") {
        if (!r.vars.has(v.result.variable)) throw new Error(`variable ${v.result.variable} not set`);
        return { kind: "value", value: r.vars.get(v.result.variable) };
      }
      if (!r.prints.length) throw new Error("program printed nothing");
      return { kind: "value", value: v.result === "all-prints" ? r.prints : r.prints[r.prints.length - 1] };
    }
    case "logic": {
      const need = <T>(x: T | undefined, name: string): T => {
        if (x === undefined) throw new Error(`logic verifier needs '${name}'`);
        return x;
      };
      switch (v.task) {
        case "eval": return { kind: "value", value: logic.evalWith(need(v.formula, "formula"), need(v.assignment, "assignment")) };
        case "count": return { kind: "value", value: logic.countTrue(need(v.formula, "formula")) };
        case "tautology": return { kind: "value", value: logic.isTautology(need(v.formula, "formula")) };
        case "contradiction": return { kind: "value", value: !logic.isSatisfiable(need(v.formula, "formula")) };
        case "satisfiable": return { kind: "value", value: logic.isSatisfiable(need(v.formula, "formula")) };
        case "valid": return { kind: "value", value: logic.entails(need(v.premises, "premises"), need(v.conclusion, "conclusion")) };
        case "options-equivalent": {
          const t = need(v.target, "target");
          return { kind: "indices", indices: need(v.formulas, "formulas").flatMap((f, i) => (logic.equivalent(t, f) ? [i] : [])) };
        }
        case "options-implied": {
          const ps = need(v.premises, "premises");
          return { kind: "indices", indices: need(v.formulas, "formulas").flatMap((f, i) => (logic.entails(ps, f) ? [i] : [])) };
        }
        case "options-tautology":
          return { kind: "indices", indices: need(v.formulas, "formulas").flatMap((f, i) => (logic.isTautology(f) ? [i] : [])) };
        case "options-eval": {
          const env = need(v.assignment, "assignment");
          return { kind: "indices", indices: need(v.formulas, "formulas").flatMap((f, i) => (logic.evalWith(f, env) ? [i] : [])) };
        }
        case "options-valid":
          return { kind: "indices", indices: need(v.arguments, "arguments").flatMap((a, i) => (logic.entails(a.premises, a.conclusion) ? [i] : [])) };
      }
      throw new Error("unknown logic task");
    }
    case "js": {
      const fn = new Function("q", "h", v.code) as (q: Question, hh: typeof h) => unknown;
      const out = fn(q, h);
      if (out && typeof out === "object" && !Array.isArray(out)) {
        const o = out as Record<string, unknown>;
        if (typeof o.index === "number") return { kind: "index", index: o.index };
        if (Array.isArray(o.indices)) return { kind: "indices", indices: o.indices as number[] };
        if (Array.isArray(o.order)) return { kind: "order", order: o.order as number[] };
      }
      return { kind: "value", value: out };
    }
  }
}

// -------------------------------------------------------------- comparison

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

function check(q: Question, v: Verifier, out: Outcome): string | null {
  const optionValues = "optionValues" in v ? v.optionValues : undefined;
  switch (q.type) {
    case "short": {
      if (out.kind !== "value") return `expected a value, got ${out.kind}`;
      if (q.answer.kind === "numeric") {
        const n = typeof out.value === "number" ? out.value : parseNum(out.value);
        if (n === null) return `verifier returned non-number ${JSON.stringify(out.value)}`;
        const tol = q.answer.tolerance ?? 1e-9 * Math.max(1, Math.abs(q.answer.value));
        // Numerical verifiers (derivatives, integrals) need a small slack even for exact answers.
        const slack = Math.max(tol, v.kind === "js" ? 1e-5 * Math.max(1, Math.abs(q.answer.value)) : 0);
        return Math.abs(n - q.answer.value) <= slack ? null : `computed ${n}, answer key says ${q.answer.value}`;
      }
      const got = normText(valueToString(out.value), q.answer);
      const ok = q.answer.accepted.some((a) => normText(a, q.answer.kind === "text" ? q.answer : {}) === got);
      return ok ? null : `computed "${got}", accepted: ${q.answer.accepted.join(" | ")}`;
    }
    case "mc": {
      if (out.kind === "index") return out.index === q.answer ? null : `verifier picked option ${out.index}, key says ${q.answer}`;
      if (out.kind === "indices") return sameSet(out.indices, [q.answer]) ? null : `matching options ${JSON.stringify(out.indices)}, key says [${q.answer}]`;
      if (out.kind !== "value") return `unexpected outcome ${out.kind}`;
      if (typeof out.value === "boolean" && v.kind === "logic" && v.boolOptions) {
        const expect = out.value ? v.boolOptions[0] : v.boolOptions[1];
        return expect === q.answer ? null : `logic result ${out.value} → option ${expect}, key says ${q.answer}`;
      }
      const labels = optionValues ?? q.options;
      if (labels.length !== q.options.length) return "optionValues length differs from options";
      const hits = labels.flatMap((o, i) => (matches(out.value, o) ? [i] : []));
      if (hits.length === 0) return `computed ${valueToString(out.value)} matches no option`;
      if (hits.length > 1) return `computed ${valueToString(out.value)} matches several options ${JSON.stringify(hits)}`;
      return hits[0] === q.answer ? null : `computed ${valueToString(out.value)} = option ${hits[0]}, key says ${q.answer}`;
    }
    case "multi": {
      if (out.kind === "indices") return sameSet(out.indices, q.answer) ? null : `verifier set ${JSON.stringify(out.indices)}, key says ${JSON.stringify(q.answer)}`;
      if (out.kind === "value" && Array.isArray(out.value) && out.value.every((x) => typeof x === "boolean")) {
        const idx = (out.value as boolean[]).flatMap((b, i) => (b ? [i] : []));
        return sameSet(idx, q.answer) ? null : `verifier set ${JSON.stringify(idx)}, key says ${JSON.stringify(q.answer)}`;
      }
      return `multi-select verifier must return indices or booleans`;
    }
    case "order": {
      if (out.kind === "order" || out.kind === "indices") {
        const got = out.kind === "order" ? out.order : out.indices;
        return JSON.stringify(got) === JSON.stringify(q.answer) ? null : `verifier order ${JSON.stringify(got)}, key says ${JSON.stringify(q.answer)}`;
      }
      if (out.kind === "value" && Array.isArray(out.value)) {
        const labels = optionValues ?? q.options;
        const order = (out.value as unknown[]).map((x) => labels.findIndex((o) => matches(x, o)));
        if (order.includes(-1)) return `computed order ${valueToString(out.value)} does not map onto options`;
        return JSON.stringify(order) === JSON.stringify(q.answer) ? null : `verifier order ${JSON.stringify(order)}, key says ${JSON.stringify(q.answer)}`;
      }
      return "order verifier must return an order";
    }
  }
}

export function verifyQuestion(q: Question): VerifyResult {
  if (!q.verifier) {
    if (q.verified === "manual") return { id: q.id, status: "manual", method: "manual", detail: q.manualNote ?? "checked by hand" };
    return { id: q.id, status: "missing", method: "-", detail: "no verifier and not marked manual" };
  }
  const method = q.verifier.kind === "logic" ? `logic:${q.verifier.task}` : q.verifier.kind;
  try {
    const out = runVerifier(q, q.verifier);
    const err = check(q, q.verifier, out);
    return err ? { id: q.id, status: "failed", method, detail: err } : { id: q.id, status: "verified", method, detail: "answer key reproduced" };
  } catch (e) {
    return { id: q.id, status: "failed", method, detail: `verifier error: ${(e as Error).message}` };
  }
}
