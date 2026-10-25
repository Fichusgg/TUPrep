# PROGRESS

Checkpoints are recorded here instead of git commits (see README → "Working environment").

## Checkpoint 1 — Scaffold & content engine (2026-10-24)

- Node v20.19.6 detected (requirement: ≥ 20.9 for Next 16). `engines` + `.nvmrc` added.
- Manual Next.js 16 + React 19 + TypeScript + Tailwind v4 scaffold (no `create-next-app`, because it runs `git init`).
- Dependencies pinned to exact versions; `npm audit` reports 0 vulnerabilities (Next 15 → 16 and Vitest 3 → 4 to clear advisories).
- Official procedure facts checked against tudelft.nl and tue.nl pages for 2027-2028 (see `src/content/exams.ts`).
- Content model: 3 sections, 21 topics with lessons + worked examples, 89 hand-written questions (38 math, 26 logic, 25 algorithms), 47 seeded generators
  (a generated question id `gen:<generator>:<seed>` fully reproduces the question).
- Core libs: grading (lenient numeric parsing), deterministic set builder, scoring (TU/e weights), Leitner SRS, stats, localStorage store.
- Unit tests: 65 passing (`npm test`), incl. 300 seeds per generator validated for structure + determinism.

## Checkpoint 2 — UI (2026-10-24)

- App shell with desktop and mobile navigation, light/dark/system theme (applied before paint), accessible focus styles.
- Pages: dashboard, learn index and 21 lesson pages (static), practice (quick-start, custom sets, deep links
  `?topic=…&start=1`), mock exams (per-section clocks, mark-for-review, question grid, breaks, resume after reload,
  auto-submit at time-out), mock results (weighted score, per-topic breakdown, answer review), review deck, progress, exam info, settings.
- Set builder now spreads questions across topics and avoids repeating a generator. The RNG seed is scrambled, because plain
  mulberry32 gave near-identical first draws for nearby seeds.

## Checkpoint 3 — Verification & docs (2026-10-24)

- `npm run check`: typecheck clean, 66 unit tests pass, production build succeeds (31 static pages + dynamic `/mock/[id]`).
- `npm run e2e:install`: Playwright Chromium downloaded into `node_modules/playwright-core/.local-browsers`.
- `npm run e2e`: 5 of 5 smoke tests pass (dashboard and exam info, practice flow, full sprint mock, theme persistence,
  mobile menu with no horizontal overflow). Screenshots were reviewed manually.
- README with features, scripts, Vercel notes, content guide and assumptions.
- Not done: no deployment, no git (by design). The in-app browser preview could not start a server in this session,
  so the visual check used Playwright screenshots instead.

## Checkpoint 4 — Rebuild to the full brief: facts, schema, verification engine, logic + algorithmic banks (2026-10-24)

- Full brief received. Re-checked facts against the **2027-2028** official documents:
  - TU Delft CST (Brochure 2 v2 + Regulation 2027-2028): **two** tests — Mathematics 50% (60 min) and Systematic
    Reasoning & Logical Thinking 50% (45 min); online on **Thu 18 or Tue 23 Feb 2027**; no calculator; formula sheet provided.
    The algorithmic part of earlier years is gone at Delft.
  - TU/e (departmental regulations 2027-2028 art. 3, 6 + BCS dates PDF): selection day **Sat 6 Mar 2027**;
    Mathematics 10%, Logical Reasoning 40%, Algorithmic Thinking 40%, VWO grade 10%; scores standardised; Pruefster proctoring.
- New dependencies: zod 4.6.7, katex 0.19.1, @anthropic-ai/sdk 1.3.0, tsx, eslint 9 + eslint-config-next (0 vulnerabilities).
- `src/content/schema.ts` (Zod) for questions (mc/multi/short/order), units, resources, unit tests, mocks, blueprints.
- `content-verify/`: propositional-logic engine, pseudocode interpreter (runs the exact code shown), brute-force/numeric helpers,
  `verify:content` + REPORT.md; `scripts/validate-content.ts` for `validate:content`.
- Content so far: 18 units (+ M7 Geometry & vectors from the CST syllabus), 22 resources, config/schedule.config.ts,
  L1–L5 (125 q) and A1–A6 (150 q) — 273 machine-verified, 2 manual.

## Checkpoint 5 — All content written and machine-verified (2026-10-24)

- Banks: L1–L5 25 each, A1–A6 25 each, M1–M7 20 each = 415 questions, difficulty spread 32/44/24 (logic, alg) and 30/45/25 (math).
- Two fully written mocks (`content/tests/mock-1.json`, `mock-2.json`): 3 sections × 20 new questions each (120 total).
- `npm run validate:content` passes; `npm run verify:content`: 535 checked, 533 machine-verified, 2 manual, 0 failed
  (report in `content-verify/REPORT.md`).

## Checkpoint 6 — App rebuilt around units, schedule, timed tests, Ask and analytics (2026-10-24)

- Storage adapter (`src/lib/storage.ts`) + store v2 (`src/lib/store.ts`): attempts, error log, bookmarks, runs, active run,
  questions log, tutor chats, ticked tasks, reschedule overrides, resources done, study log, key dates, settings; export/import.
- Schedule generator (`src/lib/schedule.ts`) from `config/schedule.config.ts`: 19 weeks, phases P0–P4, hour budgets, rest day,
  lighter weeks, taper, checkpoints (auto-evaluated), AP badges, reschedule-remaining.
- Pages: dashboard, schedule (today/week, all weeks, calendar, key dates), units + unit tabs (overview, practice, timed test,
  ask, my errors), practice, mocks (written ×2 in CST/TU/e format, generate from blueprint excluding seen), run player
  (deadline timer, no pause, auto-submit, no-going-back), results, review (1/3/7/21 days, error types), analytics,
  resources, ask, exam info, settings. `/api/tutor` (Anthropic SDK; key + model from env).
- `npm run mocks:generate` CLI; ESLint 9 flat config; lint + typecheck clean; production build succeeds.

## Checkpoint 7 — Verification & docs (2026-10-24)

- `npm run check` passes end to end: lint (0 problems), typecheck, validate:content, verify:content
  (538 checked, 536 machine-verified, 2 manual, 0 failed), 26 unit tests, production build (32 static pages + /api/tutor + /results/[id]).
- `npm run e2e`: 6/6 Playwright smoke tests pass (dashboard + schedule ticking + calendar; unit practice with hint, Ask log,
  tutor "not set up" state; timed unit test with no-going-back surviving a reload → results → review; written mock in CST
  format section by section → weighted score + readiness; analytics/resources/settings dark mode + tutor API 503 without
  key; mobile 375 px without horizontal overflow).
- Not verified: a real tutor call against the Anthropic API (no key in this environment, by design).
- README rewritten for the full brief (setup, env vars, adding questions, regenerating schedule/mocks, Vercel steps, assumptions).

## Checkpoint 8 — UX/UI redesign (2026-10-24)

- Prompt in `docs/UX_REDESIGN_PROMPT.md`; implemented the core of it:
  - Navigation: 5 sections (Today, Learn, Practice, Plan, Progress) with sub-links, settings icon, bottom tab bar on phones.
  - Today: one "Next up" hero action, today's checklist, streak / review / weekly-goal tiles, learning-path summary per part.
  - Learn: unit cards in study order with status (Not started / In progress / Test passed) and Start/Continue;
    unit pages as a 4-step path (Learn → Practice → Timed test → Review) with Key ideas / Common traps callouts.
  - Practice: one-click "Practise 10 questions", customise panel, recommendations; focus mode with segmented progress,
    larger text and targets, sticky action bar on phones, bigger session summary.
  - Schedule tasks colour-coded by type; reduced-motion support.
- lint, typecheck, unit tests, build and 6/6 Playwright smoke tests pass.
