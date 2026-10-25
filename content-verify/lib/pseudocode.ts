/**
 * Interpreter for the pseudocode dialect used in TUPrep questions, so that the code a student
 * sees is exactly the code that is executed to verify the answer key.
 *
 * Dialect (indentation = 2 spaces per block level):
 *   x ← expr            (also <-)            A[i] ← expr        arrays/strings are 1-indexed
 *   if cond then  …  else if cond then  …  else  …
 *   if cond then <statement>                (single-line form)
 *   while cond          for i from a to b [step s]     for i from a down to b
 *   for each x in A     repeat … until cond
 *   function f(a, b)  …  return expr
 *   print e1, e2        swap X and Y
 * Expressions: + − · * / div mod ^, = ≠ < > ≤ ≥ (and != <= >=), and or not, true false,
 *   "strings", [array, literals], f(x), A[i], length(A).
 * Built-ins: length, push, pop, enqueue, dequeue, append, floor, ceil, abs, min, max, sqrt,
 *   array(n, v), isEmpty, str, int.
 */

export type Value = number | boolean | string | Value[] | null;

interface Ctx {
  vars: Map<string, Value>;
}

class ReturnSignal {
  constructor(public value: Value) {}
}

type Expr =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "var"; name: string }
  | { k: "arr"; items: Expr[] }
  | { k: "idx"; target: Expr; index: Expr }
  | { k: "call"; name: string; args: Expr[] }
  | { k: "un"; op: string; a: Expr }
  | { k: "bin"; op: string; a: Expr; b: Expr };

type Stmt =
  | { k: "assign"; target: Expr; value: Expr; line: number }
  | { k: "expr"; e: Expr; line: number }
  | { k: "print"; items: Expr[]; line: number }
  | { k: "swap"; a: Expr; b: Expr; line: number }
  | { k: "return"; e: Expr | null; line: number }
  | { k: "if"; branches: { cond: Expr | null; body: Stmt[] }[]; line: number }
  | { k: "while"; cond: Expr; body: Stmt[]; line: number }
  | { k: "repeat"; cond: Expr; body: Stmt[]; line: number }
  | { k: "for"; v: string; from: Expr; to: Expr; step: Expr | null; down: boolean; body: Stmt[]; line: number }
  | { k: "foreach"; v: string; iter: Expr; body: Stmt[]; line: number }
  | { k: "func"; name: string; params: string[]; body: Stmt[]; line: number };

// ------------------------------------------------------------------ tokenizer

type Tok = { t: "num" | "str" | "id" | "op" | "kw"; v: string };
const KEYWORDS = new Set([
  "if", "then", "else", "while", "do", "for", "from", "to", "down", "step", "each", "in", "repeat", "until",
  "function", "return", "print", "swap", "and", "or", "not", "mod", "div", "true", "false",
]);

function tokenize(line: string, lineNo: number): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (line.startsWith("//", i)) break;
    const two = line.slice(i, i + 2);
    if (["<-", "!=", "<=", ">="].includes(two)) {
      out.push({ t: "op", v: { "<-": "←", "!=": "≠", "<=": "≤", ">=": "≥" }[two]! });
      i += 2;
      continue;
    }
    if ("←+-−·*/^()[],=≠<>≤≥×".includes(c)) {
      out.push({ t: "op", v: c === "−" ? "-" : c === "·" || c === "×" ? "*" : c });
      i++;
      continue;
    }
    if (c === '"') {
      const j = line.indexOf('"', i + 1);
      if (j < 0) throw new Error(`line ${lineNo}: unterminated string`);
      out.push({ t: "str", v: line.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(line.slice(i));
    if (num) { out.push({ t: "num", v: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
    if (id) {
      out.push({ t: KEYWORDS.has(id[0]) ? "kw" : "id", v: id[0] });
      i += id[0].length;
      continue;
    }
    throw new Error(`line ${lineNo}: unexpected character '${c}'`);
  }
  return out;
}

// ---------------------------------------------------------------- expressions

class ExprParser {
  p = 0;
  constructor(private toks: Tok[], private lineNo: number) {}
  peek(o = 0) { return this.toks[this.p + o]; }
  is(v: string) { const t = this.peek(); return !!t && (t.t === "op" || t.t === "kw") && t.v === v; }
  eat(v: string) {
    if (!this.is(v)) throw new Error(`line ${this.lineNo}: expected '${v}' but found '${this.peek()?.v ?? "end of line"}'`);
    this.p++;
  }
  done() { return this.p >= this.toks.length; }

  expr(): Expr { return this.or(); }
  or(): Expr { let a = this.and(); while (this.is("or")) { this.p++; a = { k: "bin", op: "or", a, b: this.and() }; } return a; }
  and(): Expr { let a = this.not(); while (this.is("and")) { this.p++; a = { k: "bin", op: "and", a, b: this.not() }; } return a; }
  not(): Expr { if (this.is("not")) { this.p++; return { k: "un", op: "not", a: this.not() }; } return this.cmp(); }
  cmp(): Expr {
    const a = this.add();
    for (const op of ["=", "≠", "<", ">", "≤", "≥"]) if (this.is(op)) { this.p++; return { k: "bin", op, a, b: this.add() }; }
    return a;
  }
  add(): Expr {
    let a = this.mul();
    while (this.is("+") || this.is("-")) { const op = this.peek().v; this.p++; a = { k: "bin", op, a, b: this.mul() }; }
    return a;
  }
  mul(): Expr {
    let a = this.unary();
    while (this.is("*") || this.is("/") || this.is("div") || this.is("mod")) { const op = this.peek().v; this.p++; a = { k: "bin", op, a, b: this.unary() }; }
    return a;
  }
  unary(): Expr { if (this.is("-")) { this.p++; return { k: "un", op: "-", a: this.unary() }; } return this.pow(); }
  pow(): Expr {
    const a = this.postfix();
    if (this.is("^")) { this.p++; return { k: "bin", op: "^", a, b: this.unary() }; }
    return a;
  }
  postfix(): Expr {
    let e = this.primary();
    while (this.is("[")) { this.p++; const index = this.expr(); this.eat("]"); e = { k: "idx", target: e, index }; }
    return e;
  }
  primary(): Expr {
    const t = this.peek();
    if (!t) throw new Error(`line ${this.lineNo}: unexpected end of expression`);
    if (t.t === "num") { this.p++; return { k: "num", v: Number(t.v) }; }
    if (t.t === "str") { this.p++; return { k: "str", v: t.v }; }
    if (t.t === "kw" && (t.v === "true" || t.v === "false")) { this.p++; return { k: "bool", v: t.v === "true" }; }
    if (this.is("(")) { this.p++; const e = this.expr(); this.eat(")"); return e; }
    if (this.is("[")) {
      this.p++;
      const items: Expr[] = [];
      if (!this.is("]")) { items.push(this.expr()); while (this.is(",")) { this.p++; items.push(this.expr()); } }
      this.eat("]");
      return { k: "arr", items };
    }
    if (t.t === "id") {
      this.p++;
      if (this.is("(")) {
        this.p++;
        const args: Expr[] = [];
        if (!this.is(")")) { args.push(this.expr()); while (this.is(",")) { this.p++; args.push(this.expr()); } }
        this.eat(")");
        return { k: "call", name: t.v, args };
      }
      return { k: "var", name: t.v };
    }
    throw new Error(`line ${this.lineNo}: unexpected '${t.v}'`);
  }
  /** Postfix-only parse used for lvalues and swap operands (stops before 'and'). */
  lvalue(): Expr { return this.postfix(); }
}

// ----------------------------------------------------------------- statements

interface Line { indent: number; toks: Tok[]; no: number; raw: string }

function splitLines(src: string): Line[] {
  return src
    .split("\n")
    .map((raw, i) => ({ raw, no: i + 1 }))
    .filter(({ raw }) => raw.trim() !== "" && !raw.trim().startsWith("//"))
    .map(({ raw, no }) => {
      const indent = raw.length - raw.trimStart().length;
      return { indent, toks: tokenize(raw.trim(), no), no, raw };
    });
}

export function parseProgram(src: string): Stmt[] {
  const lines = splitLines(src);
  let i = 0;

  const block = (indent: number): Stmt[] => {
    const out: Stmt[] = [];
    while (i < lines.length && lines[i].indent >= indent) {
      if (lines[i].indent > indent) throw new Error(`line ${lines[i].no}: unexpected indentation`);
      out.push(statement(indent));
    }
    return out;
  };

  const childBlock = (indent: number, no: number): Stmt[] => {
    if (i >= lines.length || lines[i].indent <= indent) throw new Error(`line ${no}: expected an indented block`);
    return block(lines[i].indent);
  };

  const simple = (ep: ExprParser, no: number): Stmt => {
    if (ep.is("print")) {
      ep.p++;
      const items = [ep.expr()];
      while (ep.is(",")) { ep.p++; items.push(ep.expr()); }
      return { k: "print", items, line: no };
    }
    if (ep.is("return")) {
      ep.p++;
      return { k: "return", e: ep.done() ? null : ep.expr(), line: no };
    }
    if (ep.is("swap")) {
      ep.p++;
      const a = ep.lvalue();
      ep.eat("and");
      return { k: "swap", a, b: ep.lvalue(), line: no };
    }
    // assignment or expression statement
    const save = ep.p;
    const target = ep.lvalue();
    if (ep.is("←")) {
      ep.p++;
      return { k: "assign", target, value: ep.expr(), line: no };
    }
    ep.p = save;
    return { k: "expr", e: ep.expr(), line: no };
  };

  const statement = (indent: number): Stmt => {
    const L = lines[i++];
    const ep = new ExprParser(L.toks, L.no);
    const end = () => { if (!ep.done()) throw new Error(`line ${L.no}: unexpected '${ep.peek().v}'`); };

    if (ep.is("if")) {
      ep.p++;
      const cond = ep.expr();
      ep.eat("then");
      if (!ep.done()) {
        const s = simple(ep, L.no);
        end();
        return { k: "if", branches: [{ cond, body: [s] }], line: L.no };
      }
      const branches = [{ cond: cond as Expr | null, body: childBlock(indent, L.no) }];
      while (i < lines.length && lines[i].indent === indent && lines[i].toks[0]?.v === "else") {
        const E = lines[i++];
        const ep2 = new ExprParser(E.toks, E.no);
        ep2.eat("else");
        if (ep2.is("if")) {
          ep2.p++;
          const c = ep2.expr();
          ep2.eat("then");
          branches.push({ cond: c, body: childBlock(indent, E.no) });
        } else {
          branches.push({ cond: null, body: childBlock(indent, E.no) });
          break;
        }
      }
      return { k: "if", branches, line: L.no };
    }
    if (ep.is("while")) {
      ep.p++;
      const cond = ep.expr();
      if (ep.is("do")) ep.p++;
      end();
      return { k: "while", cond, body: childBlock(indent, L.no), line: L.no };
    }
    if (ep.is("repeat")) {
      ep.p++;
      end();
      const body = childBlock(indent, L.no);
      const U = lines[i++];
      if (!U || U.indent !== indent || U.toks[0]?.v !== "until") throw new Error(`line ${L.no}: repeat without until`);
      const ep2 = new ExprParser(U.toks, U.no);
      ep2.eat("until");
      return { k: "repeat", cond: ep2.expr(), body, line: L.no };
    }
    if (ep.is("for")) {
      ep.p++;
      if (ep.is("each")) {
        ep.p++;
        const v = ep.peek().v; ep.p++;
        ep.eat("in");
        const iter = ep.expr();
        if (ep.is("do")) ep.p++;
        end();
        return { k: "foreach", v, iter, body: childBlock(indent, L.no), line: L.no };
      }
      const v = ep.peek().v; ep.p++;
      ep.eat("from");
      const from = ep.expr();
      let down = false;
      if (ep.is("down")) { ep.p++; down = true; }
      ep.eat("to");
      const to = ep.expr();
      let step: Expr | null = null;
      if (ep.is("step")) { ep.p++; step = ep.expr(); }
      if (ep.is("do")) ep.p++;
      end();
      return { k: "for", v, from, to, step, down, body: childBlock(indent, L.no), line: L.no };
    }
    if (ep.is("function")) {
      ep.p++;
      const name = ep.peek().v; ep.p++;
      ep.eat("(");
      const params: string[] = [];
      if (!ep.is(")")) { params.push(ep.peek().v); ep.p++; while (ep.is(",")) { ep.p++; params.push(ep.peek().v); ep.p++; } }
      ep.eat(")");
      end();
      return { k: "func", name, params, body: childBlock(indent, L.no), line: L.no };
    }
    const s = simple(ep, L.no);
    end();
    return s;
  };

  const prog = block(lines[0]?.indent ?? 0);
  if (i < lines.length) throw new Error(`line ${lines[i].no}: could not parse`);
  return prog;
}

// ------------------------------------------------------------------ evaluator

export interface RunResult {
  prints: Value[];
  vars: Map<string, Value>;
}

const MAX_STEPS = 2_000_000;

export function run(src: string, inputs: Record<string, Value> = {}): RunResult {
  const prog = parseProgram(src);
  const funcs = new Map<string, Extract<Stmt, { k: "func" }>>();
  for (const s of prog) if (s.k === "func") funcs.set(s.name, s);
  const prints: Value[] = [];
  let steps = 0;
  const tick = () => { if (++steps > MAX_STEPS) throw new Error("step limit exceeded (infinite loop?)"); };

  const num = (v: Value, line: number): number => {
    if (typeof v !== "number") throw new Error(`line ${line}: expected a number, got ${JSON.stringify(v)}`);
    return v;
  };
  const truthy = (v: Value, line: number): boolean => {
    if (typeof v !== "boolean") throw new Error(`line ${line}: condition must be true/false, got ${JSON.stringify(v)}`);
    return v;
  };
  const eq = (a: Value, b: Value): boolean => JSON.stringify(a) === JSON.stringify(b);

  const evalE = (e: Expr, ctx: Ctx, line: number): Value => {
    tick();
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "bool": return e.v;
      case "arr": return e.items.map((x) => evalE(x, ctx, line));
      case "var": {
        if (!ctx.vars.has(e.name)) throw new Error(`line ${line}: variable '${e.name}' used before assignment`);
        return ctx.vars.get(e.name)!;
      }
      case "idx": {
        const t = evalE(e.target, ctx, line);
        const i = num(evalE(e.index, ctx, line), line);
        if (typeof t === "string" || Array.isArray(t)) {
          if (!Number.isInteger(i) || i < 1 || i > t.length) throw new Error(`line ${line}: index ${i} out of range 1..${t.length}`);
          return t[i - 1];
        }
        throw new Error(`line ${line}: cannot index ${JSON.stringify(t)}`);
      }
      case "un": {
        const a = evalE(e.a, ctx, line);
        return e.op === "not" ? !truthy(a, line) : -num(a, line);
      }
      case "bin": {
        if (e.op === "and") return truthy(evalE(e.a, ctx, line), line) && truthy(evalE(e.b, ctx, line), line);
        if (e.op === "or") return truthy(evalE(e.a, ctx, line), line) || truthy(evalE(e.b, ctx, line), line);
        const a = evalE(e.a, ctx, line);
        const b = evalE(e.b, ctx, line);
        switch (e.op) {
          case "=": return eq(a, b);
          case "≠": return !eq(a, b);
          case "+":
            if (typeof a === "string" || typeof b === "string") return String(a) + String(b);
            if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
            return num(a, line) + num(b, line);
        }
        if ((e.op === "<" || e.op === ">" || e.op === "≤" || e.op === "≥") && typeof a === "string" && typeof b === "string") {
          return e.op === "<" ? a < b : e.op === ">" ? a > b : e.op === "≤" ? a <= b : a >= b;
        }
        const x = num(a, line), y = num(b, line);
        switch (e.op) {
          case "-": return x - y;
          case "*": return x * y;
          case "/": if (y === 0) throw new Error(`line ${line}: division by zero`); return x / y;
          case "div": if (y === 0) throw new Error(`line ${line}: division by zero`); return Math.floor(x / y);
          case "mod": if (y === 0) throw new Error(`line ${line}: mod by zero`); return ((x % y) + y) % y;
          case "^": return x ** y;
          case "<": return x < y;
          case ">": return x > y;
          case "≤": return x <= y;
          case "≥": return x >= y;
        }
        throw new Error(`line ${line}: unknown operator ${e.op}`);
      }
      case "call": return call(e.name, e.args, ctx, line);
    }
  };

  const arrArg = (v: Value, line: number): Value[] => {
    if (!Array.isArray(v)) throw new Error(`line ${line}: expected an array`);
    return v;
  };

  const call = (name: string, argEs: Expr[], ctx: Ctx, line: number): Value => {
    // Mutating built-ins need the array reference itself.
    if (["push", "append", "enqueue"].includes(name)) {
      const A = arrArg(evalE(argEs[0], ctx, line), line);
      A.push(evalE(argEs[1], ctx, line));
      return null;
    }
    if (name === "pop") {
      const A = arrArg(evalE(argEs[0], ctx, line), line);
      if (!A.length) throw new Error(`line ${line}: pop from empty`);
      return A.pop()!;
    }
    if (name === "dequeue") {
      const A = arrArg(evalE(argEs[0], ctx, line), line);
      if (!A.length) throw new Error(`line ${line}: dequeue from empty`);
      return A.shift()!;
    }
    const args = argEs.map((a) => evalE(a, ctx, line));
    switch (name) {
      case "length": {
        const a = args[0];
        if (typeof a === "string" || Array.isArray(a)) return a.length;
        throw new Error(`line ${line}: length of non-array`);
      }
      case "isEmpty": return arrArg(args[0], line).length === 0;
      case "floor": return Math.floor(num(args[0], line));
      case "ceil": return Math.ceil(num(args[0], line));
      case "abs": return Math.abs(num(args[0], line));
      case "sqrt": return Math.sqrt(num(args[0], line));
      case "min": return Math.min(...args.map((a) => num(a, line)));
      case "max": return Math.max(...args.map((a) => num(a, line)));
      case "array": return Array.from({ length: num(args[0], line) }, () => structuredClone(args[1] ?? 0));
      case "str": return String(args[0]);
      case "int": return Number.parseInt(String(args[0]), 10);
    }
    const f = funcs.get(name);
    if (!f) throw new Error(`line ${line}: unknown function '${name}'`);
    if (f.params.length !== args.length) throw new Error(`line ${line}: ${name} expects ${f.params.length} arguments`);
    const local: Ctx = { vars: new Map() };
    // Arrays are passed by reference (as in most languages); scalars by value.
    f.params.forEach((p, i) => local.vars.set(p, args[i]));
    try {
      execBlock(f.body, local);
    } catch (sig) {
      if (sig instanceof ReturnSignal) return sig.value;
      throw sig;
    }
    return null;
  };

  const assign = (target: Expr, value: Value, ctx: Ctx, line: number) => {
    if (target.k === "var") { ctx.vars.set(target.name, value); return; }
    if (target.k === "idx") {
      const container = evalE(target.target, ctx, line);
      const i = num(evalE(target.index, ctx, line), line);
      if (!Array.isArray(container)) throw new Error(`line ${line}: can only assign into arrays`);
      if (!Number.isInteger(i) || i < 1 || i > container.length) throw new Error(`line ${line}: index ${i} out of range 1..${container.length}`);
      container[i - 1] = value;
      return;
    }
    throw new Error(`line ${line}: invalid assignment target`);
  };

  const execBlock = (stmts: Stmt[], ctx: Ctx) => {
    for (const s of stmts) exec(s, ctx);
  };

  const exec = (s: Stmt, ctx: Ctx) => {
    tick();
    switch (s.k) {
      case "func": return;
      case "assign": {
        const v = evalE(s.value, ctx, s.line);
        // Assigning an array copies it, so `B ← A` never aliases (keeps traces unambiguous).
        assign(s.target, Array.isArray(v) ? structuredClone(v) : v, ctx, s.line);
        return;
      }
      case "expr": evalE(s.e, ctx, s.line); return;
      case "print": {
        const vals = s.items.map((e) => evalE(e, ctx, s.line));
        prints.push(vals.length === 1 ? structuredClone(vals[0]) : structuredClone(vals));
        return;
      }
      case "swap": {
        const a = evalE(s.a, ctx, s.line);
        const b = evalE(s.b, ctx, s.line);
        assign(s.a, b, ctx, s.line);
        assign(s.b, a, ctx, s.line);
        return;
      }
      case "return": throw new ReturnSignal(s.e ? evalE(s.e, ctx, s.line) : null);
      case "if": {
        for (const br of s.branches) {
          if (br.cond === null || truthy(evalE(br.cond, ctx, s.line), s.line)) { execBlock(br.body, ctx); return; }
        }
        return;
      }
      case "while":
        while (truthy(evalE(s.cond, ctx, s.line), s.line)) execBlock(s.body, ctx);
        return;
      case "repeat":
        do execBlock(s.body, ctx); while (!truthy(evalE(s.cond, ctx, s.line), s.line));
        return;
      case "for": {
        const from = num(evalE(s.from, ctx, s.line), s.line);
        const to = num(evalE(s.to, ctx, s.line), s.line);
        const step = s.step ? num(evalE(s.step, ctx, s.line), s.line) : 1;
        if (step <= 0) throw new Error(`line ${s.line}: step must be positive`);
        if (s.down) for (let i = from; i >= to; i -= step) { ctx.vars.set(s.v, i); execBlock(s.body, ctx); }
        else for (let i = from; i <= to; i += step) { ctx.vars.set(s.v, i); execBlock(s.body, ctx); }
        return;
      }
      case "foreach": {
        const it = evalE(s.iter, ctx, s.line);
        const items = typeof it === "string" ? it.split("") : arrArg(it, s.line);
        for (const x of [...items]) { ctx.vars.set(s.v, x); execBlock(s.body, ctx); }
        return;
      }
    }
  };

  const ctx: Ctx = { vars: new Map(Object.entries(inputs)) };
  try {
    execBlock(prog, ctx);
  } catch (sig) {
    if (!(sig instanceof ReturnSignal)) throw sig;
  }
  return { prints, vars: ctx.vars };
}

export function show(v: Value): string {
  if (Array.isArray(v)) return `[${v.map(show).join(", ")}]`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e9) / 1e9);
  return String(v);
}
