/**
 * npm run mocks:generate -- --blueprint cst|tue [--exclude progress.json] [--seed 123] [--title "My mock"]
 *
 * Builds a new mock from the question banks following a blueprint (unit mix + difficulty mix) and appends it to
 * content/tests/generated-mocks.json, where the app picks it up on the Mocks page.
 * --exclude takes a progress export from Settings → Export; every question you have answered is skipped
 * (questions are only reused when the bank runs out, and the count is reported).
 */
import fs from "node:fs";
import path from "node:path";
import { BlueprintsFile, GeneratedMocksFile, QuestionFile } from "../src/content/schema";
import { generateMock } from "../src/lib/mockgen";
import { listJson, readJson, ROOT } from "../content-verify/lib/load";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const bpId = arg("blueprint") ?? "cst";
const blueprint = BlueprintsFile.parse(readJson("tests/blueprints.json")).find((b) => b.id === bpId);
if (!blueprint) {
  console.error(`Unknown blueprint "${bpId}" (use cst or tue).`);
  process.exit(1);
}
const bank = listJson("questions").flatMap((rel) => QuestionFile.parse(readJson(rel)));

const exclude = new Set<string>();
const excludeFile = arg("exclude");
if (excludeFile) {
  const data = JSON.parse(fs.readFileSync(path.resolve(excludeFile), "utf8")) as { attempts?: { qid: string }[]; runs?: { sections: { items: { qid: string }[] }[] }[] };
  for (const a of data.attempts ?? []) exclude.add(a.qid);
  for (const r of data.runs ?? []) for (const s of r.sections) for (const it of s.items) exclude.add(it.qid);
}
// Questions already used in earlier generated mocks are also avoided.
const outFile = path.join(ROOT, "content", "tests", "generated-mocks.json");
const existing = GeneratedMocksFile.parse(JSON.parse(fs.readFileSync(outFile, "utf8")));
for (const m of existing) for (const s of m.sections) for (const id of s.qids) exclude.add(id);

const seed = Number(arg("seed") ?? Date.now() % 2 ** 31);
const { sections, repeats } = generateMock(blueprint, bank, { exclude, seed });
const n = existing.filter((m) => m.blueprint === blueprint.id).length + 1;
const mock = {
  id: `gen-${blueprint.id}-${n}`,
  title: arg("title") ?? `Generated ${blueprint.id === "cst" ? "TU Delft CST" : "TU/e"} mock ${n}`,
  blueprint: blueprint.id,
  createdAt: new Date().toISOString(),
  sections,
};
fs.writeFileSync(outFile, JSON.stringify([...existing, mock], null, 2) + "\n");
console.log(`Wrote ${mock.id} (${sections.map((s) => `${s.title}: ${s.qids.length}`).join(", ")}) to content/tests/generated-mocks.json`);
console.log(`Excluded ${exclude.size} seen/used questions; ${repeats} repeat(s) were unavoidable.`);
