/**
 * npm run validate:content
 * Fails on schema errors, duplicate ids, missing answers/explanations, answers not present in the
 * options, estimated times outside 20–300 s, broken KaTeX, unknown units/resources, and questions that
 * have neither a verifier nor `verified: "manual"`. Coverage minimums and difficulty spread are reported.
 */
import katex from "katex";
import type { z } from "zod";
import {
  BlueprintsFile,
  GeneratedMocksFile,
  Mock,
  QuestionFile,
  ResourcesFile,
  UnitTestsFile,
  UnitsFile,
  type Question,
} from "../src/content/schema";
import { listJson, readJson, readText } from "../content-verify/lib/load";

const errors: string[] = [];
const warnings: string[] = [];

function parse<T extends z.ZodTypeAny>(schema: T, rel: string): z.infer<T> | null {
  let raw: unknown;
  try {
    raw = readJson(rel);
  } catch (e) {
    errors.push(`${rel}: invalid JSON (${(e as Error).message})`);
    return null;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const issue of r.error.issues.slice(0, 20)) {
      errors.push(`${rel}: ${issue.path.join(".") || "(root)"} — ${issue.message}`);
    }
    return null;
  }
  return r.data;
}

function checkKatex(where: string, text: string) {
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tex = m[1] ?? m[2];
    try {
      katex.renderToString(tex, { throwOnError: true, displayMode: Boolean(m[1]) });
    } catch (e) {
      errors.push(`${where}: KaTeX error in "${tex}": ${(e as Error).message.split("\n")[0]}`);
    }
  }
}

function checkQuestion(q: Question, where: string) {
  const at = `${where} ${q.id}`;
  if (!q.explanation.trim()) errors.push(`${at}: missing explanation`);
  if (!q.verifier && q.verified !== "manual") errors.push(`${at}: needs a verifier or verified: "manual"`);
  if (q.verifier && q.verified === "manual") errors.push(`${at}: has a verifier and is also marked manual`);
  if (q.verified === "manual" && !q.manualNote) warnings.push(`${at}: manual question without manualNote`);
  if (q.verifier?.kind === "pseudocode" && !q.verifier.code && !q.code) errors.push(`${at}: pseudocode verifier without code`);

  switch (q.type) {
    case "mc":
      if (q.answer >= q.options.length) errors.push(`${at}: answer index ${q.answer} not in options`);
      if (new Set(q.options).size !== q.options.length) errors.push(`${at}: duplicate options`);
      break;
    case "multi":
      if (q.answer.some((a) => a >= q.options.length)) errors.push(`${at}: answer index not in options`);
      if (new Set(q.answer).size !== q.answer.length) errors.push(`${at}: duplicate answer indices`);
      if (new Set(q.options).size !== q.options.length) errors.push(`${at}: duplicate options`);
      break;
    case "order": {
      const sorted = [...q.answer].sort((a, b) => a - b);
      if (q.answer.length !== q.options.length || sorted.some((x, i) => x !== i)) errors.push(`${at}: order answer must be a permutation of the options`);
      break;
    }
    case "short":
      if (q.answer.kind === "text" && q.answer.accepted.some((a) => !a.trim())) errors.push(`${at}: empty accepted answer`);
      break;
  }
  const v = q.verifier;
  if (v && "optionValues" in v && v.optionValues && "options" in q && v.optionValues.length !== q.options.length) {
    errors.push(`${at}: optionValues has ${v.optionValues.length} entries for ${q.options.length} options`);
  }
  if (v?.kind === "logic" && v.task.startsWith("options-") && "options" in q) {
    const n = v.task === "options-valid" ? v.arguments?.length : v.formulas?.length;
    if (n !== q.options.length) errors.push(`${at}: logic verifier lists ${n} formulas for ${q.options.length} options`);
  }
  for (const text of [q.prompt, q.hint, q.explanation, ...("options" in q ? q.options : [])]) checkKatex(at, text);
}

// ------------------------------------------------------------------ run

const units = parse(UnitsFile, "units/units.json") ?? [];
const unitIds = new Set(units.map((u) => u.id));
const resources = parse(ResourcesFile, "resources.json") ?? [];
const resourceIds = new Set(resources.map((r) => r.id));
const seen = new Map<string, string>();
const bank: Question[] = [];

const dupCheck = (id: string, where: string) => {
  if (seen.has(id)) errors.push(`duplicate id ${id} in ${where} (also in ${seen.get(id)})`);
  else seen.set(id, where);
};

if (new Set(resources.map((r) => r.id)).size !== resources.length) errors.push("resources.json: duplicate resource ids");
for (const r of resources) {
  for (const u of r.units) if (!unitIds.has(u)) errors.push(`resources.json ${r.id}: unknown unit ${u}`);
  if (r.status === "verified" && !r.url) errors.push(`resources.json ${r.id}: verified resource without url`);
}

for (const u of units) {
  for (const r of u.resources) if (!resourceIds.has(r)) errors.push(`units.json ${u.id}: unknown resource ${r}`);
  const md = readText(`units/${u.id}.md`);
  if (!md) errors.push(`units/${u.id}.md missing`);
  else {
    if (!/## Key ideas/i.test(md)) errors.push(`units/${u.id}.md: needs a "## Key ideas" section`);
    if (!/## Common traps/i.test(md)) errors.push(`units/${u.id}.md: needs a "## Common traps" section`);
    checkKatex(`units/${u.id}.md`, md);
  }
}

for (const rel of listJson("questions")) {
  const qs = parse(QuestionFile, rel);
  if (!qs) continue;
  const expectedUnit = rel.match(/([A-Z]\d)\.json$/)?.[1];
  for (const q of qs) {
    dupCheck(q.id, rel);
    if (!unitIds.has(q.unit)) errors.push(`${rel} ${q.id}: unknown unit ${q.unit}`);
    if (expectedUnit && q.unit !== expectedUnit) errors.push(`${rel} ${q.id}: unit ${q.unit} in file for ${expectedUnit}`);
    checkQuestion(q, rel);
    bank.push(q);
  }
}

const mockFiles = listJson("tests").filter((f) => /mock-\d+\.json$/.test(f));
for (const rel of mockFiles) {
  const m = parse(Mock, rel);
  if (!m) continue;
  for (const s of m.sections) {
    for (const q of s.questions) {
      dupCheck(q.id, rel);
      if (!unitIds.has(q.unit)) errors.push(`${rel} ${q.id}: unknown unit ${q.unit}`);
      const part = units.find((u) => u.id === q.unit)?.part;
      if (part && part !== s.part) errors.push(`${rel} ${q.id}: unit ${q.unit} is ${part}, section is ${s.part}`);
      checkQuestion(q, rel);
    }
  }
}

const unitTests = parse(UnitTestsFile, "tests/unit-tests.json") ?? [];
for (const t of unitTests) {
  if (!unitIds.has(t.unit)) errors.push(`unit-tests.json: unknown unit ${t.unit}`);
  const available = bank.filter((q) => q.unit === t.unit).length;
  if (available < t.count) errors.push(`unit-tests.json ${t.unit}: needs ${t.count} questions, bank has ${available}`);
}
for (const u of units) if (!unitTests.some((t) => t.unit === u.id)) errors.push(`unit ${u.id} has no timed test in unit-tests.json`);

const blueprints = parse(BlueprintsFile, "tests/blueprints.json") ?? [];
for (const b of blueprints) {
  for (const s of b.sections) for (const u of Object.keys(s.units)) if (!unitIds.has(u)) errors.push(`blueprints.json ${b.id}: unknown unit ${u}`);
}
const generated = parse(GeneratedMocksFile, "tests/generated-mocks.json") ?? [];
const bankIds = new Set(bank.map((q) => q.id));
for (const g of generated) for (const s of g.sections) for (const id of s.qids) if (!bankIds.has(id)) errors.push(`generated-mocks.json ${g.id}: unknown question ${id}`);

if (mockFiles.length < 2) errors.push(`need at least 2 fully written mocks, found ${mockFiles.length}`);

// ---------------------------------------------------------------- report

console.log("\nQuestion bank per unit");
console.log("unit  count  min  d1/d2/d3        verifier  manual");
for (const u of units) {
  const qs = bank.filter((q) => q.unit === u.id);
  const min = u.part === "math" ? 20 : 25;
  const d = [1, 2, 3].map((k) => qs.filter((q) => q.difficulty === k).length);
  const pct = d.map((x) => (qs.length ? Math.round((x / qs.length) * 100) : 0));
  const manual = qs.filter((q) => q.verified === "manual").length;
  console.log(`${u.id.padEnd(5)} ${String(qs.length).padStart(5)}  ${String(min).padStart(3)}  ${pct.join("/").padEnd(14)}  ${String(qs.length - manual).padStart(8)}  ${String(manual).padStart(6)}`);
  if (qs.length < min) warnings.push(`${u.id}: ${qs.length} questions, minimum is ${min}`);
  if (qs.length >= 10 && (Math.abs(pct[0] - 30) > 12 || Math.abs(pct[1] - 45) > 15 || Math.abs(pct[2] - 25) > 12)) {
    warnings.push(`${u.id}: difficulty spread ${pct.join("/")} is far from 30/45/25`);
  }
}
console.log(`\n${bank.length} bank questions, ${mockFiles.length} written mocks, ${unitTests.length} unit tests, ${resources.length} resources.`);

for (const w of warnings) console.log(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nvalidate:content FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log("\nvalidate:content passed.");
