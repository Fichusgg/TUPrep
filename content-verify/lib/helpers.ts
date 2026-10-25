/**
 * Helper library available as `h` inside `js` verifiers. Everything here is brute force or
 * numerical, so a verifier recomputes an answer independently of how the question was written.
 */
import * as logic from "./logic";
import { run, show, type Value } from "./pseudocode";

export const range = (a: number, b: number, step = 1): number[] => {
  const out: number[] = [];
  for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i);
  return out;
};

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

export function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    for (const rest of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

export function combinations<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (xs.length < k) return [];
  const [first, ...rest] = xs;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

/** Cartesian product of the given arrays. */
export function product<T>(...lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap((a) => list.map((x) => [...a, x])), [[]]);
}

/** All tuples of length n over the values. */
export function tuples<T>(values: T[], n: number): T[][] {
  return product(...Array.from({ length: n }, () => values));
}

export const forall = <T>(dom: T[], p: (x: T) => boolean) => dom.every(p);
export const exists = <T>(dom: T[], p: (x: T) => boolean) => dom.some(p);

/** Reduced fraction as "a/b" (or "a" when b = 1). */
export function frac(n: number, d: number): string {
  const g = gcd(n, d) || 1;
  let a = n / g, b = d / g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? String(a) : `${a}/${b}`;
}

// --------------------------------------------------------------- numerics

/** Numerical derivative (5-point stencil). */
export function deriv(f: (x: number) => number, x: number, h = 1e-4): number {
  return (-f(x + 2 * h) + 8 * f(x + h) - 8 * f(x - h) + f(x - 2 * h)) / (12 * h);
}
export function deriv2(f: (x: number) => number, x: number, h = 1e-3): number {
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
}

/** Composite Simpson's rule. */
export function integrate(f: (x: number) => number, a: number, b: number, n = 20000): number {
  if (n % 2) n++;
  const hh = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * hh) * (i % 2 ? 4 : 2);
  return (s * hh) / 3;
}

/** One-sided numerical limit estimate. */
export function limit(f: (x: number) => number, a: number, side: "left" | "right" | "both" = "both"): number {
  const at = (s: number) => f(a + s * 1e-7);
  if (side === "left") return at(-1);
  if (side === "right") return at(1);
  const l = at(-1), r = at(1);
  if (Math.abs(l - r) > 1e-3 * Math.max(1, Math.abs(l))) return NaN;
  return (l + r) / 2;
}
export function limitInf(f: (x: number) => number, sign: 1 | -1 = 1): number {
  return f(sign * 1e8);
}

export const approx = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Bisection root finder on [a, b] (f(a) and f(b) must differ in sign). */
export function root(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2, fm = f(m);
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}

/** Real solutions of f(x) = 0 on [a, b], found by sign changes on a fine grid. */
export function roots(f: (x: number) => number, a: number, b: number, n = 100000): number[] {
  const out: number[] = [];
  let px = a, pv = f(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n, v = f(x);
    if (pv === 0) out.push(px);
    else if (Math.sign(v) !== Math.sign(pv) && Number.isFinite(v) && Number.isFinite(pv)) out.push(root(f, px, x));
    px = x; pv = v;
  }
  return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-6);
}

// ------------------------------------------------------------------ graphs

export type Graph = Record<string, string[]>;

/** Undirected graph from "A-B" edge strings. */
export function graph(edges: string[]): Graph {
  const g: Graph = {};
  for (const e of edges) {
    const [a, b] = e.split("-").map((s) => s.trim());
    (g[a] ??= []).push(b);
    (g[b] ??= []).push(a);
  }
  return g;
}

export function bfsDist(g: Graph, start: string): Record<string, number> {
  const dist: Record<string, number> = { [start]: 0 };
  const q = [start];
  while (q.length) {
    const u = q.shift()!;
    for (const v of g[u] ?? []) if (!(v in dist)) { dist[v] = dist[u] + 1; q.push(v); }
  }
  return dist;
}

/** Weighted undirected edges "A-B:5". Returns shortest distances (Dijkstra). */
export function dijkstra(edges: string[], start: string): Record<string, number> {
  const adj: Record<string, [string, number][]> = {};
  for (const e of edges) {
    const [ab, w] = e.split(":");
    const [a, b] = ab.split("-").map((s) => s.trim());
    (adj[a] ??= []).push([b, Number(w)]);
    (adj[b] ??= []).push([a, Number(w)]);
  }
  const dist: Record<string, number> = {};
  for (const k of Object.keys(adj)) dist[k] = Infinity;
  dist[start] = 0;
  const done = new Set<string>();
  while (done.size < Object.keys(adj).length) {
    let u: string | null = null;
    for (const k of Object.keys(adj)) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
    if (u === null || dist[u] === Infinity) break;
    done.add(u);
    for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
  }
  return dist;
}

/** Count simple paths from s to t in a directed graph given as "A>B" edges. */
export function countPaths(edges: string[], s: string, t: string): number {
  const adj: Record<string, string[]> = {};
  for (const e of edges) { const [a, b] = e.split(">"); (adj[a.trim()] ??= []).push(b.trim()); }
  const go = (u: string, seen: Set<string>): number => {
    if (u === t) return 1;
    let n = 0;
    for (const v of adj[u] ?? []) if (!seen.has(v)) { seen.add(v); n += go(v, seen); seen.delete(v); }
    return n;
  };
  return go(s, new Set([s]));
}

/** Minimum spanning tree weight (Kruskal) for "A-B:w" edges. */
export function mstWeight(edges: string[]): number {
  const parsed = edges.map((e) => { const [ab, w] = e.split(":"); const [a, b] = ab.split("-").map((s) => s.trim()); return { a, b, w: Number(w) }; });
  parsed.sort((x, y) => x.w - y.w);
  const parent: Record<string, string> = {};
  const find = (x: string): string => (parent[x] === undefined || parent[x] === x ? (parent[x] = x) : (parent[x] = find(parent[x])));
  let total = 0;
  for (const { a, b, w } of parsed) { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; total += w; } }
  return total;
}

/** Topological orders count / existence for "A>B" edges over the given nodes. */
export function topoOrders(nodes: string[], edges: string[]): string[][] {
  const before = edges.map((e) => e.split(">").map((s) => s.trim()) as [string, string]);
  return permutations(nodes).filter((order) => before.every(([a, b]) => order.indexOf(a) < order.indexOf(b)));
}

// ------------------------------------------------------------- re-exports

export { logic, run, show };
export type { Value };

/** Run pseudocode and return the last printed value. */
export function lastPrint(code: string, inputs: Record<string, Value> = {}): Value {
  const r = run(code, inputs);
  if (!r.prints.length) throw new Error("program printed nothing");
  return r.prints[r.prints.length - 1];
}
