/**
 * Loads and validates everything under /content once. Used by both client and server code.
 * Unit markdown is read separately on the server (see ./server.ts).
 */
import blueprintsJson from "@content/tests/blueprints.json";
import generatedJson from "@content/tests/generated-mocks.json";
import mock1 from "@content/tests/mock-1.json";
import mock2 from "@content/tests/mock-2.json";
import unitTestsJson from "@content/tests/unit-tests.json";
import resourcesJson from "@content/resources.json";
import unitsJson from "@content/units/units.json";
import A1 from "@content/questions/A1.json";
import A2 from "@content/questions/A2.json";
import A3 from "@content/questions/A3.json";
import A4 from "@content/questions/A4.json";
import A5 from "@content/questions/A5.json";
import A6 from "@content/questions/A6.json";
import L1 from "@content/questions/L1.json";
import L2 from "@content/questions/L2.json";
import L3 from "@content/questions/L3.json";
import L4 from "@content/questions/L4.json";
import L5 from "@content/questions/L5.json";
import M1 from "@content/questions/M1.json";
import M2 from "@content/questions/M2.json";
import M3 from "@content/questions/M3.json";
import M4 from "@content/questions/M4.json";
import M5 from "@content/questions/M5.json";
import M6 from "@content/questions/M6.json";
import M7 from "@content/questions/M7.json";
import {
  BlueprintsFile,
  GeneratedMocksFile,
  Mock,
  QuestionFile,
  ResourcesFile,
  UnitTestsFile,
  UnitsFile,
  type PartId,
  type Question,
  type Unit,
} from "./schema";

export const UNITS: Unit[] = UnitsFile.parse(unitsJson);
export const UNIT_BY_ID: Record<string, Unit> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const RESOURCES = ResourcesFile.parse(resourcesJson);
export const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));
export const UNIT_TESTS = UnitTestsFile.parse(unitTestsJson);
export const BLUEPRINTS = BlueprintsFile.parse(blueprintsJson);
export const WRITTEN_MOCKS = [Mock.parse(mock1), Mock.parse(mock2)];
export const GENERATED_MOCKS = GeneratedMocksFile.parse(generatedJson);

export const BANK: Question[] = QuestionFile.parse([
  ...L1, ...L2, ...L3, ...L4, ...L5,
  ...A1, ...A2, ...A3, ...A4, ...A5, ...A6,
  ...M1, ...M2, ...M3, ...M4, ...M5, ...M6, ...M7,
]);

const ALL: Question[] = [...BANK, ...WRITTEN_MOCKS.flatMap((m) => m.sections.flatMap((s) => s.questions))];
const BY_ID = new Map(ALL.map((q) => [q.id, q]));

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}

export function bankForUnit(unit: string): Question[] {
  return BANK.filter((q) => q.unit === unit);
}

export const PARTS: { id: PartId; title: string; short: string; delft: string | null; tue: string }[] = [
  { id: "math", title: "Mathematics", short: "Maths", delft: "Mathematics (50%, 60 min)", tue: "Mathematics test (10%)" },
  { id: "logic", title: "Systematic Reasoning & Logical Thinking", short: "Logic", delft: "Systematic Reasoning & Logical Thinking (50%, 45 min)", tue: "Logical Reasoning test (40%)" },
  { id: "algorithmic", title: "Algorithmic & Computational Thinking", short: "Algorithmic", delft: null, tue: "Algorithmic Thinking test (40%)" },
];
export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, (typeof PARTS)[number]>;

export function unitsForPart(part: PartId): Unit[] {
  return UNITS.filter((u) => u.part === part);
}

export type { Question, Unit, PartId };
