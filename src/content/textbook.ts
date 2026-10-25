/**
 * Reading guide for the official TU Delft preparation text for Systematic Reasoning & Logical Thinking:
 * Delftse Foundations of Computation (2nd ed., v2.0.1), chapter 2 — skip the starred (*) sections.
 * Section titles follow the book's own outline; the book text itself is not reproduced here.
 */
export const TEXTBOOK = {
  title: "Delftse Foundations of Computation",
  edition: "2nd edition (v2.0.1, 2022)",
  authors: "Stefan Hugtenburg and Neil Yorke-Smith",
  publisher: "TU Delft OPEN",
  license: "CC BY-NC-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  bookPage: "https://books.open.tudelft.nl/home/catalog/book/211",
  pdf: "https://books.open.tudelft.nl/home/catalog/download/211/393/640?inline=1",
  interactive: "https://doi.org/10.59490/tb.92",
  /** Optional self-hosted copy (allowed by the licence for non-commercial use with attribution). */
  localPdf: "/textbooks/delftse-foundations-of-computation.pdf",
} as const;

export interface TextbookSection {
  id: string;
  title: string;
  units: string[];
  minutes: number;
  why: string;
  parts: { title: string; skip?: boolean }[];
}

export const CHAPTER_2: TextbookSection[] = [
  {
    id: "2.1",
    title: "Propositional Logic",
    units: ["L1", "L2", "L5"],
    minutes: 180,
    why: "The core of the test: connectives, truth tables, precedence, and reading implications in English.",
    parts: [
      { title: "Propositions" },
      { title: "Logical operators" },
      { title: "Precedence rules" },
      { title: "Logical equivalence" },
      { title: "More logical operators" },
      { title: "Implications in English" },
      { title: "More forms of implication" },
      { title: "Exclusive or" },
      { title: "Universal operators" },
      { title: "Classifying propositions" },
    ],
  },
  {
    id: "2.2",
    title: "Boolean Algebra",
    units: ["L2"],
    minutes: 120,
    why: "The laws you use to rewrite and simplify formulas quickly.",
    parts: [{ title: "Basics of Boolean Algebra" }, { title: "Substitution laws" }, { title: "Simplifications" }, { title: "More rules of Boolean algebra" }],
  },
  {
    id: "2.3",
    title: "Application: Logic Circuits",
    units: ["L2"],
    minutes: 40,
    why: "Only Disjunctive Normal Form is required; the circuit sections are starred.",
    parts: [
      { title: "Logic gates", skip: true },
      { title: "Combining gates to create circuits", skip: true },
      { title: "From circuits to propositions", skip: true },
      { title: "Disjunctive Normal Form" },
      { title: "Binary addition", skip: true },
    ],
  },
  {
    id: "2.4",
    title: "Predicate Logic",
    units: ["L3"],
    minutes: 150,
    why: "Quantifiers, their negation and order, and checking statements in small worlds.",
    parts: [{ title: "Predicates" }, { title: "Quantifiers" }, { title: "Operators" }, { title: "Tarski's world and formal structures" }, { title: "Logical equivalence" }],
  },
  {
    id: "2.5",
    title: "Deduction",
    units: ["L4", "L5"],
    minutes: 150,
    why: "Valid and invalid arguments, and short proofs — the reasoning behind L4 and the puzzles in L5.",
    parts: [{ title: "Arguments" }, { title: "Valid arguments and proofs" }, { title: "Proofs in predicate logic" }],
  },
];

/** Key used for the done/to-do state of one part (stored with the resource toggles). */
export const partKey = (sectionId: string, title: string) => `foc:${sectionId}:${title}`;
