import { describe, expect, it } from "vitest";
import * as logic from "../../content-verify/lib/logic";
import { run } from "../../content-verify/lib/pseudocode";
import * as h from "../../content-verify/lib/helpers";
import { verifyQuestion } from "../../content-verify/lib/verify";
import type { Question } from "@/content/schema";

describe("logic engine", () => {
  it("respects precedence and right-associative implication", () => {
    expect(logic.equivalent("p ∧ q ∨ r", "(p ∧ q) ∨ r")).toBe(true);
    expect(logic.equivalent("p → q → r", "p → (q → r)")).toBe(true);
    expect(logic.equivalent("p → q → r", "(p → q) → r")).toBe(false);
    expect(logic.equivalent("¬p ∨ q", "p → q")).toBe(true);
  });
  it("detects tautologies, entailment and counts", () => {
    expect(logic.isTautology("p ∨ ¬p")).toBe(true);
    expect(logic.isTautology("(p → q) → p")).toBe(false);
    expect(logic.entails(["p → q", "¬q"], "¬p")).toBe(true);
    expect(logic.entails(["p → q", "q"], "p")).toBe(false);
    expect(logic.countTrue("p ⊕ q")).toBe(2);
    expect(logic.countTrue("p -> q")).toBe(3);
    expect(logic.equivalent("p <-> q", "(p implies q) and (q implies p)")).toBe(true);
  });
});

describe("pseudocode interpreter", () => {
  it("runs loops, arrays (1-indexed), functions and recursion", () => {
    const code = `s ← 0
for i from 1 to 4
  s ← s + i · i
print s`;
    expect(run(code).prints).toEqual([30]);
    const rec = `function f(n)
  if n ≤ 1 then return n
  return f(n − 1) + f(n − 2)
print f(10)`;
    expect(run(rec).prints).toEqual([55]);
    const arr = `A ← [5, 1, 4, 2, 8]
for i from 1 to 4
  if A[i] > A[i + 1] then
    swap A[i] and A[i + 1]
print A`;
    expect(run(arr).prints).toEqual([[1, 4, 2, 5, 8]]);
  });
  it("supports while, else-if chains, repeat-until, div/mod and stacks", () => {
    const code = `x ← 13
r ← 0
while x > 0
  r ← r · 2 + (x mod 2)
  x ← x div 2
if r > 20 then
  print "big"
else if r > 10 then
  print r
else
  print 0
S ← []
push(S, 1)
push(S, 2)
y ← pop(S)
repeat
  y ← y + 3
until y > 10
print y, length(S)`;
    expect(run(code).prints).toEqual([11, [11, 1]]);
  });
  it("reports out-of-range indexes", () => {
    expect(() => run("A ← [1, 2]\nprint A[3]")).toThrow(/out of range/);
  });
});

describe("verifyQuestion", () => {
  const base = { unit: "A2", tags: ["t"], difficulty: 1 as const, prompt: "What is printed?", hint: "trace it", explanation: "Trace the loop.", estSeconds: 60, source: "original" as const };
  it("passes a correct key and fails a wrong one", () => {
    const good: Question = { ...base, id: "T-001", type: "short", code: "print 2 + 3", answer: { kind: "numeric", value: 5 }, verifier: { kind: "pseudocode", result: "last-print" } };
    const bad = { ...good, id: "T-002", answer: { kind: "numeric", value: 6 } } as Question;
    expect(verifyQuestion(good).status).toBe("verified");
    expect(verifyQuestion(bad).status).toBe("failed");
  });
  it("checks that exactly one MC option matches", () => {
    const q: Question = { ...base, id: "T-003", type: "mc", options: ["3/8", "1/4", "0.375"], answer: 0, verifier: { kind: "js", code: "return 3/8" } };
    expect(verifyQuestion(q).detail).toMatch(/several options/);
  });
  it("verifies logic option sets", () => {
    const q: Question = {
      ...base, unit: "L2", id: "T-004", type: "mc", options: ["¬p ∨ ¬q", "¬p ∧ ¬q", "p ∨ q"], answer: 0,
      verifier: { kind: "logic", task: "options-equivalent", target: "¬(p ∧ q)", formulas: ["¬p ∨ ¬q", "¬p ∧ ¬q", "p ∨ q"] },
    };
    expect(verifyQuestion(q).status).toBe("verified");
  });
});

describe("numeric helpers", () => {
  it("differentiates and integrates", () => {
    expect(h.deriv((x) => x ** 3, 2)).toBeCloseTo(12, 6);
    expect(h.integrate((x) => x * x, 0, 3)).toBeCloseTo(9, 8);
    expect(h.choose(8, 3)).toBe(56);
    expect(h.dijkstra(["A-B:1", "B-C:2", "A-C:5"], "A").C).toBe(3);
  });
});
