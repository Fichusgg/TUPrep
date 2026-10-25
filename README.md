# TUPrep

A personal, single-user prep site for the **TU Delft BSc CSE Cognitive Skills Test (CST)** and the **TU/e BSc CSE
selection tests**, September 2027 intake. It includes:

- a week-by-week schedule generated from one config file;
- a curated resource library;
- 18 units, each with a written summary, practice, a timed test, a Q&A space with an optional AI tutor, and an error log;
- full mock exams;
- spaced review;
- analytics.

There are no accounts and no backend database. Progress lives in your browser behind a small storage adapter, and you can
export or import it as one JSON file.

> **Read this first: the facts changed.** The official 2027-2028 documents (read on 24 Oct 2026) say the TU Delft CST now
> has **two** tests: **Mathematics 50% (60 min)** and **Systematic Reasoning & Logical Thinking 50% (45 min)**. They take
> place online on **Thu 18 or Tue 23 Feb 2027**. The algorithmic part of earlier years is gone at Delft. Algorithmic
> Thinking is still **40%** at TU/e (selection day **Sat 6 Mar 2027**; Maths 10%, Logical Reasoning 40%, Algorithmic 40%,
> VWO grade 10%).
>
> Because maths is now half of the Delft score, consider raising the maths share in `config/schedule.config.ts`
> (`allocation`). Your decision: study time stays at 60–65% logic + algorithmic / 15–20% maths, while mocks,
> timed tests and scores keep the real tests' structure and weights (CST 50/50; TU/e 10/40/40).

## Quick start

Requires Node.js ≥ 20.9 (see `.nvmrc`).

```bash
npm install
npm run dev            # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development server, production build, production server |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run validate:content` | Zod schemas plus content rules (see below); fails on any error |
| `npm run verify:content` | Re-computes every machine-checkable answer key and writes `content-verify/REPORT.md` |
| `npm test` | Vitest unit tests (verification engine, grading, spaced review, schedule, mock generator, scoring, store) |
| `npm run e2e:install` | Downloads Playwright Chromium **into the project** (`PLAYWRIGHT_BROWSERS_PATH=0`) |
| `npm run e2e` | Builds, serves on port 3123 and runs the Playwright smoke test of the main flows |
| `npm run check` | lint → typecheck → validate → verify → unit tests → build |
| `npm run schedule:print` | Prints the generated week-by-week plan in the terminal |
| `npm run mocks:generate -- --blueprint cst\|tue [--exclude progress.json]` | Builds a new mock from the banks |

## Environment variables (optional AI tutor)

Copy `.env.example` to `.env.local` locally, or add the variables in Vercel.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Your Anthropic API key. Read only by the server route `src/app/api/tutor/route.ts`. |
| `ANTHROPIC_MODEL` | The model id the tutor uses. The code never hard-codes one; `.env.example` suggests a current default. |

Without these, the tutor tab shows setup instructions and everything else works. Tutor chat messages are the only data
that leave the browser.

## Deploying to Vercel

1. Copy this folder into your git repository, then commit and push.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the detected Next.js defaults
   (build `next build`, install `npm install`). Use Node 20 or newer.
3. Optional: under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`
   (Production + Preview), then redeploy.
4. Open the deployment. `/api/tutor` (GET) should return `{"configured": true}` once the variables are set.

`next.config.ts` already includes `content/units/*.md` in the tutor function's bundle.

## Where things live

```
config/schedule.config.ts     dates, hours, phases, allocation, pace, AP pacing — the ONE file to edit
content/units/units.json      the 18 units (part, scope, resources, relevance)
content/units/<ID>.md         key ideas + common traps per unit (original text)
content/questions/<ID>.json   question banks (418 questions)
content/tests/unit-tests.json one timed test per unit (drawn from that unit's bank)
content/tests/mock-1.json     fully written mock 1 (3 × 20 new questions)
content/tests/mock-2.json     fully written mock 2 (3 × 20 new questions)
content/tests/blueprints.json mock blueprints: CST (2 sections) and TU/e (3 sections), unit + difficulty mix
content/tests/generated-mocks.json  mocks made by `npm run mocks:generate`
content/resources.json        resource library (only the resources from the brief + 2 official pages marked as extras)
content-verify/               verification engine + REPORT.md
src/content/schema.ts         Zod schemas for all content
src/lib/                      store + storage adapter, schedule generator, mock generator, grading, spaced review, runs
src/app/                      pages (dashboard, schedule, units, practice, mocks, run, results, review, analytics,
                              resources, ask, exam info, settings) and /api/tutor
```

## Adding or editing questions

Add an object to `content/questions/<UNIT>.json`. Every question needs:

- `id` (e.g. `L3-026`), `unit`, `tags` (topic tags) and `difficulty` (1–3);
- `prompt` (supports `$…$` / `$$…$$` KaTeX, `**bold**`, `` `code` `` and `- ` lists) and an optional `code` block;
- `type` with its answer:
  - `mc`: `options` + `answer` index;
  - `multi`: `options` + `answer` indices;
  - `short`: `answer: {kind:"numeric", value, tolerance?}` or `{kind:"text", accepted:[…], caseSensitive?, ignoreSpaces?}`;
  - `order`: `options` + `answer` as the correct sequence of indices;
- `hint` (one level before the answer), `explanation` (the worked solution), `estSeconds` (20–300) and `source: "original"`;
- either a `verifier` or `verified: "manual"` with a `manualNote`.

Verifier kinds:

| kind | Use for | How it checks |
| --- | --- | --- |
| `pseudocode` | tracing items | Runs the question's own `code` in the interpreter (`content-verify/lib/pseudocode.ts`) and compares the last print, all prints or a variable |
| `logic` | propositional items | Truth-table engine: `eval`, `count`, `tautology`, `satisfiable`, `valid`, `options-equivalent`, `options-implied`, `options-tautology`, `options-eval`, `options-valid` |
| `js` | everything else | A small function body with helpers `h` (brute force over permutations/tuples, graph algorithms, numerical derivatives, integrals and limits, root finding). It returns a value, `{index}`, `{indices}` or `{order}` |

For multiple choice, a computed value must match **exactly one** option, and that option must be the answer key. Use
`optionValues` when option labels are KaTeX.

Then run `npm run validate:content && npm run verify:content`.

`validate:content` fails on:

- schema errors;
- duplicate ids;
- a missing answer or explanation;
- an answer not present in the options;
- `estSeconds` outside 20–300;
- broken KaTeX;
- unknown units or resources;
- a question with neither a verifier nor `verified: "manual"`.

It reports question counts and the difficulty spread.

**Pseudocode dialect:**

- `x ← e`, `if … then / else if / else`, `while`, `for i from a to b [step s]`, `for i from a down to b`, `for each x in A`,
  `repeat … until`, `function f(a)` … `return`, `print`, `swap X and Y`;
- `div`, `mod`, `·`, `^`, `= ≠ < > ≤ ≥`, `and`, `or`, `not`;
- arrays and strings are 1-indexed;
- built-ins: `length`, `push`, `pop`, `enqueue`, `dequeue`, `min`, `max`, `floor`, `abs`.

## Regenerating the schedule and mocks

- **Schedule:** edit `config/schedule.config.ts` and reload; the plan is generated from it. Settings there include the
  test dates (set the CST date TU Delft confirms to you), start date, hours (8 normal / 12 heavy; light-week factor),
  heavy and light weeks, rest day, taper days, phases, allocation, pace, and AP coverage.
  - `npm run schedule:print` shows the result in the terminal.
  - Task ids are deterministic, so ticked tasks survive a regeneration as long as a week's structure is unchanged.
  - "Reschedule remaining tasks" on a missed week shifts every unfinished task one week forward. It never touches test
    days or taper days, and it can be undone.
- **Mocks:** in the app, **Mocks → Generate** builds a CST or TU/e mock from the banks with the blueprint's unit and
  difficulty mix, skipping every question you have answered. Offline, `npm run mocks:generate -- --blueprint tue
  --exclude tuprep-progress.json` does the same using an export from Settings, and appends the mock to
  `content/tests/generated-mocks.json`.

## Features

- **Dashboard:**
  - countdowns for both tests (CONFIRMED/ESTIMATED);
  - key-dates strip;
  - today's tasks (checkable) and the week's checkpoint;
  - accuracy per part, progress per unit, streak, review-queue count and readiness.
- **Schedule:**
  - 19 weeks from Mon 26 Oct 2026 to Sat 6 Mar 2027;
  - each week shows its dates, hour budget, phase and focus;
  - day-by-day tasks link to a unit, resource, practice set, test or mock;
  - every week has a measurable checkpoint that is evaluated automatically against your data;
  - views: Today & this week, All weeks, and a Calendar (month);
  - you can add your own key dates;
  - reschedule for missed weeks.
- **Phases:**
  - P0 baseline (diagnostics untimed, then timed);
  - P1 foundations: L1–L3, A1–A3, M1–M4, with daily Bebras-style warm-ups;
  - P2 skill build: timed unit tests, L4–L5, A4–A6, M5–M7; winter break as optional extra capacity;
  - P3 mixed practice, weakest-tag drills, first full mocks, proctoring/equipment readiness check;
  - P4 one mock per week under exam rules with next-day review, targeted drills, and a 3-day taper before each test;
  - a full rest day every week (Sunday) and one lighter week per month.
- **Resources:**
  - grouped by part and unit, each with type, link, why it's useful, estimated time, a done/to-do toggle and the weeks it
    is scheduled;
  - link status: checked / from your brief / link needed / unverified extra.
- **Units:**
  - **Overview:** covers, AP badge for maths units ("Covered in AP by …" / "Pre-learn needed"), original key ideas +
    common traps, resources and stats;
  - **Practice:** filter by difficulty and tag; untimed, challenge (hard only), review missed, or bookmarked; instant
    feedback, worked solution, one-step hint, bookmark, and "add to error log";
  - **Timed test:** 12–15 questions by default, at the exam pace from the config; optional no-going-back;
  - **Ask:** question log + AI tutor;
  - **My errors.**
- **Timed tests and mocks:**
  - the timer is deadline-based: it survives reloads, cannot be paused and auto-submits at zero;
  - mocks have per-section timers and lock each section once submitted;
  - results show the score, time per question vs the estimate, answer review with explanations and links back to the
    unit and its resources, a by-unit breakdown, readiness and trend.
- **Mock formats:** CST (Maths 60 min + SR&LT 45 min, 50/50) and TU/e (3 × 60 min, weights 10/40/40, plus your VWO/IB
  average if you enter it in Settings).
- **Error log + spaced review:** every miss is logged automatically and resurfaces after 1, 3, 7 and 21 days. You can tag
  each one as concept / misread / time / careless and add notes.
- **Analytics:** accuracy and speed per unit vs target pace, weakest tags, hours studied vs plan (ticked tasks + a
  manual study log), and mock score trend.
- **Data:** `StorageAdapter` interface (`src/lib/storage.ts`, localStorage implementation) and JSON export/import of
  everything.
- **UI:** dark mode, responsive down to phone width, and keyboard shortcuts (1–6 / A–F to choose, Enter to check).

## Content summary

| Units | Bank | Machine-verified | Manual |
| --- | --- | --- | --- |
| L1–L5 Systematic Reasoning & Logical Thinking | 125 + 1 ordering item (L5) | all but 1 | 1 (L4-013, proof structure) |
| A1–A6 Algorithmic & Computational Thinking | 150 + 2 ordering items (A3, A4) | all but 1 | 1 (A4-006, data-structure choice) |
| M1–M7 Mathematics | 140 | all | 0 |
| Written mocks 1 and 2 | 120 (3 × 20 each) | all | 0 |

Difficulty spread per unit is 30–32% level 1, 44–45% level 2 and 24–25% level 3. The full per-question list is in
`content-verify/REPORT.md`.

All questions are original. None were copied from UK Bebras, the 2008 TU Delft example test, the Delft workshops,
Quizlet or TU/e material; those are linked as resources and marked "practice only".

## Assumptions

1. **Units:** I kept your L1–L5, A1–A6 and M1–M6, and added **M7 Geometry & vectors**, because the 2027-2028 CST maths
   syllabus covers it (sine/cosine rule, circles, vectors, dot product).
   - **X1 is not needed:** the 2027-2028 TU/e regulations list only Mathematics, Logical Reasoning and Algorithmic
     Thinking, which are all covered.
2. **Official facts** come from the 2027-2028 TU Delft Brochure 2 v2 and Regulation, and the TU/e departmental
   regulations and BCS dates PDF (links on the Exam info page).
   - Your brief described a three-part CST with 20–30 questions per part. That matches earlier years, not 2027-2028.
   - The written mocks still contain three sections. CST format runs the first two with CST timings; TU/e format runs
     all three.
3. **ESTIMATED values** (editable in config/blueprints):
   - questions per test (CST 20 + 20, TU/e 20/25/25);
   - TU/e minutes per test (60 each; only the 3-hour total is published);
   - per-question pace (Maths 180 s, Logic 135 s, Algorithmic 144 s);
   - the CST preparation-lecture date.
   - The CST date defaults to 18 Feb 2027 (the first of the two official options). Change it once TU Delft confirms your
     date.
4. **Readiness** is a heuristic: the average of your last 3 mocks of that format, banded at 50 / 65 / 80%. Neither
   university publishes pass marks, Delft uses lottery categories, and TU/e standardises scores.
5. **Your AP Calculus BC pacing** sets the "Covered in AP" badges and pre-learn tasks:
   - M4 is covered by 16 Nov and M5 by 14 Dec;
   - volumes of revolution (AP U8, 9–15 Feb), trig identities/equations and vectors need pre-learning.
6. **Resources:**
   - URLs come from your brief, or were confirmed on official pages (DelftX course page, Foundations of Computation,
     bebras.uk, Wistue, TU/e OSE).
   - Items without a URL in your brief are marked **link needed** (Google Doc notes, Quizlet, Delftprep guide, "How I Got
     In" videos, 2023 playlist, CST GPT, 2024 workshop).
   - Your Brochure 2 link returned 404, so it points to the current 2027-2028 v2 file.
7. **Hours** are 8 h/week normally and 12 h in heavy weeks: winter break (optional), the week before the CST and the
   week before TU/e. Light weeks are 60% (16 Nov, 14 Dec, 11 Jan, aligned with AP unit exams).
8. **Scoring:** text answers are normalised (trimmed, case-insensitive, spacing collapsed; `~p`, `!p` and `not p` all
   mean `¬p`). Numeric answers must be exact; fractions like `32/3` are accepted, while rounded decimals are not
   (as on the CST).

## Working environment notes

- The project was built locally in this folder: no git, no deployment, no accounts and no real secrets.
- Stage checkpoints are recorded in `PROGRESS.md` instead of commits.
- Playwright's Chromium is installed inside `node_modules`.
