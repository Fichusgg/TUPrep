/**
 * Propositional logic parser + evaluator used to verify logic questions.
 *
 * Syntax (Unicode or ASCII):
 *   ¬p  ~p  !p  not p
 *   p ∧ q   p & q   p and q
 *   p ∨ q   p | q   p or q
 *   p ⊕ q   p xor q
 *   p → q   p -> q  p => q  p implies q   (right associative)
 *   p ↔ q   p <-> q p <=> q p iff q
 *   ⊤ / true, ⊥ / false, parentheses.
 * Precedence (tight → loose): ¬, ∧, ∨, ⊕, →, ↔ — the convention of Delftse Foundations of Computation.
 */

export type Formula =
  | { op: "var"; name: string }
  | { op: "const"; value: boolean }
  | { op: "not"; a: Formula }
  | { op: "and" | "or" | "xor" | "imp" | "iff"; a: Formula; b: Formula };

type Tok = { t: string; v?: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const words: Record<string, string> = { not: "not", and: "and", or: "or", xor: "xor", implies: "imp", iff: "iff", true: "T", false: "F" };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (three === "<->" || three === "<=>") { out.push({ t: "iff" }); i += 3; continue; }
    if (two === "->" || two === "=>") { out.push({ t: "imp" }); i += 2; continue; }
    const sym: Record<string, string> = { "¬": "not", "~": "not", "!": "not", "∧": "and", "&": "and", "∨": "or", "|": "or", "⊕": "xor", "→": "imp", "⇒": "imp", "↔": "iff", "⇔": "iff", "⊤": "T", "⊥": "F", "(": "(", ")": ")" };
    if (sym[c]) { out.push({ t: sym[c] }); i++; continue; }
    const m = /^[A-Za-z][A-Za-z0-9_']*/.exec(src.slice(i));
    if (m) {
      const w = m[0];
      if (words[w.toLowerCase()] && w === w.toLowerCase()) out.push({ t: words[w] });
      else out.push({ t: "var", v: w });
      i += w.length;
      continue;
    }
    throw new Error(`Unexpected character '${c}' in formula: ${src}`);
  }
  return out;
}

export function parseFormula(src: string): Formula {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p]?.t;
  const eat = (t: string) => {
    if (toks[p]?.t !== t) throw new Error(`Expected ${t} at token ${p} in: ${src}`);
    return toks[p++];
  };
  const binary = (next: () => Formula, op: "and" | "or" | "xor" | "iff"): (() => Formula) => () => {
    let left = next();
    while (peek() === op) { p++; left = { op, a: left, b: next() }; }
    return left;
  };
  const unary = (): Formula => {
    const t = peek();
    if (t === "not") { p++; return { op: "not", a: unary() }; }
    if (t === "(") { p++; const f = iff(); eat(")"); return f; }
    if (t === "T") { p++; return { op: "const", value: true }; }
    if (t === "F") { p++; return { op: "const", value: false }; }
    if (t === "var") return { op: "var", name: toks[p++].v! };
    throw new Error(`Unexpected token ${t ?? "end"} in: ${src}`);
  };
  const and = binary(unary, "and");
  const or = binary(and, "or");
  const xor = binary(or, "xor");
  const imp = (): Formula => {
    const left = xor();
    if (peek() === "imp") { p++; return { op: "imp", a: left, b: imp() }; }
    return left;
  };
  const iff = binary(imp, "iff");
  const f = iff();
  if (p !== toks.length) throw new Error(`Trailing tokens in formula: ${src}`);
  return f;
}

export function evaluate(f: Formula, env: Record<string, boolean>): boolean {
  switch (f.op) {
    case "var":
      if (!(f.name in env)) throw new Error(`No value for variable ${f.name}`);
      return env[f.name];
    case "const": return f.value;
    case "not": return !evaluate(f.a, env);
    case "and": return evaluate(f.a, env) && evaluate(f.b, env);
    case "or": return evaluate(f.a, env) || evaluate(f.b, env);
    case "xor": return evaluate(f.a, env) !== evaluate(f.b, env);
    case "imp": return !evaluate(f.a, env) || evaluate(f.b, env);
    case "iff": return evaluate(f.a, env) === evaluate(f.b, env);
  }
}

export function variables(...fs: Formula[]): string[] {
  const set = new Set<string>();
  const walk = (f: Formula) => {
    if (f.op === "var") set.add(f.name);
    else if (f.op === "not") walk(f.a);
    else if (f.op !== "const") { walk(f.a); walk(f.b); }
  };
  fs.forEach(walk);
  return [...set].sort();
}

/** Every assignment of the given variables. */
export function* assignments(vars: string[]): Generator<Record<string, boolean>> {
  for (let m = 0; m < 2 ** vars.length; m++) {
    const env: Record<string, boolean> = {};
    vars.forEach((v, i) => (env[v] = Boolean((m >> (vars.length - 1 - i)) & 1)));
    yield env;
  }
}

const P = (s: string) => parseFormula(s);

export function countTrue(src: string): number {
  const f = P(src);
  let n = 0;
  for (const env of assignments(variables(f))) if (evaluate(f, env)) n++;
  return n;
}

export function isTautology(src: string): boolean {
  const f = P(src);
  for (const env of assignments(variables(f))) if (!evaluate(f, env)) return false;
  return true;
}

export function isSatisfiable(src: string): boolean {
  const f = P(src);
  for (const env of assignments(variables(f))) if (evaluate(f, env)) return true;
  return false;
}

export function equivalent(a: string, b: string): boolean {
  const fa = P(a), fb = P(b);
  for (const env of assignments(variables(fa, fb))) if (evaluate(fa, env) !== evaluate(fb, env)) return false;
  return true;
}

/** Premises ⊨ conclusion: no assignment makes every premise true and the conclusion false. */
export function entails(premises: string[], conclusion: string): boolean {
  const ps = premises.map(P), c = P(conclusion);
  for (const env of assignments(variables(...ps, c))) {
    if (ps.every((p) => evaluate(p, env)) && !evaluate(c, env)) return false;
  }
  return true;
}

export function evalWith(src: string, env: Record<string, boolean>): boolean {
  return evaluate(P(src), env);
}
