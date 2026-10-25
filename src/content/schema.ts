import { z } from "zod";

/** Zod schemas for everything under /content. Shared by the app, validate:content and verify:content. */

export const PartId = z.enum(["math", "logic", "algorithmic"]);
export type PartId = z.infer<typeof PartId>;

export const UnitId = z.string().regex(/^(L[1-5]|A[1-6]|M[1-7]|X1)$/, "unknown unit id");

const Difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const Verifier = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pseudocode"),
    /** Defaults to the question's own `code` block, so the code shown is the code that is run. */
    code: z.string().optional(),
    /** Which output is compared with the answer key. */
    result: z.union([z.enum(["last-print", "all-prints"]), z.object({ variable: z.string() })]).default("last-print"),
    /** For multiple choice: the value each option stands for (parallel to options). */
    optionValues: z.array(z.union([z.string(), z.number()])).optional(),
  }),
  z.object({
    kind: z.literal("logic"),
    task: z.enum([
      "eval",
      "count",
      "tautology",
      "contradiction",
      "satisfiable",
      "valid",
      "options-equivalent",
      "options-implied",
      "options-tautology",
      "options-eval",
      "options-valid",
    ]),
    formula: z.string().optional(),
    target: z.string().optional(),
    formulas: z.array(z.string()).optional(),
    premises: z.array(z.string()).optional(),
    conclusion: z.string().optional(),
    /** For options-valid: one argument per option. */
    arguments: z.array(z.object({ premises: z.array(z.string()), conclusion: z.string() })).optional(),
    assignment: z.record(z.string(), z.boolean()).optional(),
    /** For boolean results on multiple choice: [index if true, index if false]. */
    boolOptions: z.tuple([z.number().int(), z.number().int()]).optional(),
  }),
  z.object({
    kind: z.literal("js"),
    /** Body of `(q, h) => { ... }`. Must compute the answer independently (brute force, simulation, numerics). */
    code: z.string(),
    optionValues: z.array(z.union([z.string(), z.number()])).optional(),
  }),
]);
export type Verifier = z.infer<typeof Verifier>;

const Base = z.object({
  id: z.string().regex(/^[A-Z0-9]+-[A-Z0-9-]+$/, "id must look like L1-001 or MK1-M01"),
  unit: UnitId,
  tags: z.array(z.string().min(1)).min(1),
  difficulty: Difficulty,
  /** Supports $inline$ and $$display$$ KaTeX, **bold**, `code`, bullet lists. */
  prompt: z.string().min(5),
  /** Monospace pseudocode / data block. */
  code: z.string().optional(),
  hint: z.string().min(5),
  explanation: z.string().min(10),
  estSeconds: z.number().int().min(20, "estimated time must be 20–300 s").max(300, "estimated time must be 20–300 s"),
  source: z.literal("original"),
  verifier: Verifier.optional(),
  verified: z.literal("manual").optional(),
  /** Why a question could not be machine-verified. */
  manualNote: z.string().optional(),
});

export const McQuestion = Base.extend({
  type: z.literal("mc"),
  options: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().min(0),
});

export const MultiQuestion = Base.extend({
  type: z.literal("multi"),
  options: z.array(z.string().min(1)).min(3).max(8),
  answer: z.array(z.number().int().min(0)).min(1),
});

export const ShortAnswer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numeric"), value: z.number(), tolerance: z.number().min(0).optional() }),
  z.object({
    kind: z.literal("text"),
    accepted: z.array(z.string().min(1)).min(1),
    caseSensitive: z.boolean().optional(),
    ignoreSpaces: z.boolean().optional(),
  }),
]);

export const ShortQuestion = Base.extend({
  type: z.literal("short"),
  answer: ShortAnswer,
  unitLabel: z.string().optional(),
  placeholder: z.string().optional(),
});

export const OrderQuestion = Base.extend({
  type: z.literal("order"),
  /** Items as displayed (they are shuffled for the student). */
  options: z.array(z.string().min(1)).min(3).max(8),
  /** Correct sequence as indices into options. */
  answer: z.array(z.number().int().min(0)).min(3),
});

export const Question = z.discriminatedUnion("type", [McQuestion, MultiQuestion, ShortQuestion, OrderQuestion]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];

export const QuestionFile = z.array(Question);

export const Unit = z.object({
  id: UnitId,
  part: PartId,
  title: z.string(),
  covers: z.string(),
  resources: z.array(z.string()),
  /** Which test this unit matters for. */
  relevance: z.array(z.enum(["delft", "tue"])).min(1),
  /** Key into config.apPacing, math units only. */
  apTopic: z.string().optional(),
  estimated: z.boolean().optional(),
});
export type Unit = z.infer<typeof Unit>;
export const UnitsFile = z.array(Unit);

export const Resource = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  type: z.enum(["video", "textbook", "pdf", "course", "quiz", "notes", "website", "playlist", "tool"]),
  url: z.string().url().nullable(),
  parts: z.array(PartId).min(1),
  units: z.array(UnitId),
  why: z.string(),
  minutes: z.number().int().positive(),
  /**
   * verified    = on your list and the link was checked (24 Oct 2026);
   * provided    = on your list, URL/ID taken from your brief but not opened;
   * link-needed = on your list but no URL was given (add it in resources.json);
   * unverified  = an extra that was not on your list.
   */
  status: z.enum(["verified", "provided", "link-needed", "unverified"]),
  note: z.string().optional(),
  /** Do not copy questions from this resource into the banks. */
  doNotCopy: z.boolean().optional(),
});
export type Resource = z.infer<typeof Resource>;
export const ResourcesFile = z.array(Resource);

export const DifficultyMix = z.tuple([z.number(), z.number(), z.number()]);

export const UnitTest = z.object({
  unit: UnitId,
  title: z.string(),
  count: z.number().int().min(5).max(30),
  difficultyMix: DifficultyMix,
  noGoingBackDefault: z.boolean(),
});
export const UnitTestsFile = z.array(UnitTest);
export type UnitTest = z.infer<typeof UnitTest>;

export const MockSection = z.object({
  part: PartId,
  title: z.string(),
  questions: z.array(Question).min(20).max(30),
});
export const Mock = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sections: z.array(MockSection).min(2),
});
export type Mock = z.infer<typeof Mock>;

export const BlueprintSection = z.object({
  part: PartId,
  title: z.string(),
  count: z.number().int().min(5).max(40),
  minutes: z.number().int().positive(),
  /** Relative weight of each unit in the section. */
  units: z.record(z.string(), z.number().positive()),
  difficultyMix: DifficultyMix,
});
export const Blueprint = z.object({
  id: z.enum(["cst", "tue"]),
  title: z.string(),
  estimated: z.boolean(),
  note: z.string(),
  sections: z.array(BlueprintSection).min(1),
  /** Weight of each section in the composite score (percent). */
  weights: z.record(z.string(), z.number()),
});
export type Blueprint = z.infer<typeof Blueprint>;
export const BlueprintsFile = z.array(Blueprint);

/** A mock assembled from the banks by `npm run mocks:generate` (references bank ids only). */
export const GeneratedMock = z.object({
  id: z.string(),
  title: z.string(),
  blueprint: z.enum(["cst", "tue"]),
  createdAt: z.string(),
  sections: z.array(z.object({ part: PartId, title: z.string(), minutes: z.number().int().positive(), qids: z.array(z.string()).min(1) })).min(1),
});
export type GeneratedMock = z.infer<typeof GeneratedMock>;
export const GeneratedMocksFile = z.array(GeneratedMock);
