# UX/UI redesign prompt — TUPrep

Use this prompt with a coding agent (or a designer) to redesign TUPrep's interface. It is written for this codebase
(Next.js App Router, Tailwind v4 tokens in `src/app/globals.css`, primitives in `src/components/ui`).

---

## Role

You are a senior product designer and front-end engineer who has shipped learning products (think Khan Academy,
Brilliant, Duolingo, Anki). Redesign TUPrep's UI so that one student preparing for the TU Delft CST and the TU/e
selection tests always knows **what to do next**, can **study without distraction**, and **sees progress** without
reading tables. Keep every existing feature and route working; this is a design and information-architecture pass, not
a rewrite of the learning logic.

## Who it is for

- One student (IB + AP Calculus BC), studying 8–12 h/week from 26 Oct 2026 to early March 2027.
- Uses a laptop for long sessions and a phone for short ones (review queue, warm-ups).
- Weak spots: logic and algorithmic thinking. Needs momentum, not dashboards full of numbers.

## Design principles

1. **One obvious next step.** Every screen answers "what should I do now?" with a single primary button. Secondary
   actions are visually quieter.
2. **Learn → Practice → Test → Review.** Make this loop visible everywhere: on the dashboard, on unit pages and after
   results. Each step links to the next.
3. **Focus while answering.** When a question is on screen, remove everything that is not the question, the answer
   input, the hint and the check button. Reading width ≤ 70 characters; generous line height; large tap targets.
4. **Progress you can feel.** Prefer progress rings/bars, streaks and "x of y" over tables. Celebrate completion
   (a day's tasks done, a unit test ≥ 70%) with a calm, non-intrusive message.
5. **Calm, consistent visual language.** One accent colour for "do this", green only for correct/done, orange only for
   mistakes, amber for "needs attention". No decorative colour.
6. **Simple language.** Labels are verbs or plain nouns ("Continue", "Review mistakes", "Take timed test"). Avoid
   jargon like "blueprint", "SRS", "P1" in the main UI (keep them in details).
7. **Accessible by default.** WCAG 2.1 AA contrast in light and dark mode, visible focus rings, full keyboard use,
   `prefers-reduced-motion` respected, touch targets ≥ 44 px on phones.

## Information architecture

Reduce the top navigation from nine items to five learner-centred sections; keep all existing routes reachable:

| Section | Contains (existing routes) |
| --- | --- |
| **Today** | `/` dashboard |
| **Learn** | `/units`, `/units/[unit]` (overview tab), `/resources`, `/ask` |
| **Practice** | `/practice`, `/review`, `/mock`, `/units/[unit]?tab=practice|test` |
| **Plan** | `/schedule`, `/exams` |
| **Progress** | `/analytics` |

- Settings moves to a small icon/link at the right of the header.
- On phones, replace the "Menu" dropdown with a fixed **bottom tab bar** (Today, Learn, Practice, Plan, Progress) with
  icons and labels; hide it during timed tests.
- While a timed test runs, show only the test chrome (already the case) — keep it that way.

## Screen-by-screen requirements

### Today (dashboard)

- Top: a **"Next up" hero card** with the first unfinished task scheduled today (or the review queue if items are due,
  or "Start this week's first task" before the plan begins). Show title, unit/part, estimated minutes and one primary
  button ("Start", "Continue", "Review 6 mistakes").
- Below: **today's checklist** (all tasks, checkable) with a progress bar and a short completion message when done.
- A compact row of **three stat tiles**: streak, review queue, this week's checkpoint status.
- **Countdowns** become a slim strip (both tests, days left, confirmed/estimated) instead of two large cards.
- **Learning path summary**: the three parts as rows with a progress bar (share of units started/finished) and accuracy.
- Move the full key-dates strip to the Plan page; keep at most the next two dates here.

### Learn — units index

- Group by part with a one-line explanation of how the part is tested (Delft / TU/e).
- Each unit card shows: id + title, a progress bar, a status chip (Not started / In progress / Test passed), the AP
  badge for maths, and one button: **Start** or **Continue** (to the unit page).
- Order units in the recommended study order.

### Learn — unit page

- Header: unit title, part, which tests it matters for, AP badge.
- Replace the plain tabs with a **learning-path stepper**: ① Learn ② Practice ③ Timed test ④ Review — each step shows
  its state (done / available) and is clickable. "Ask" stays as a secondary tab/link.
- **Learn step:** the summary in a readable column (`max-w-prose`), "Key ideas" and "Common traps" rendered as two
  distinct callout styles (info vs warning), resources as a compact checklist in a side column, and a clear
  "I've read this → Practise" button at the end.
- **Practice step:** default to a one-click "Practise 10 questions" button; advanced filters (difficulty, tags, modes)
  live in a collapsible "Customise" panel.
- **Timed test step:** explain the rules in three bullet points, show the time budget prominently, one Start button,
  previous scores as a mini bar chart.
- **Review step:** this unit's error log with error-type chips.

### Question / practice screens (focus mode)

- Centered column, max 720 px; question text 18 px on desktop, 17 px on phones; code blocks full width.
- A thin **segmented progress bar** (one segment per question, coloured correct/incorrect once answered).
- Options are large cards with letter keys; selected state uses the accent colour; after checking, correct = green,
  chosen wrong = orange, others dimmed.
- Hint button opens an inline hint panel; after checking show "Correct!" / "Not quite" with the worked solution in a
  readable panel, then **one** primary button "Next question" (keyboard: Enter).
- On phones the action bar (Hint / Check / Next) is **sticky at the bottom**.
- Session summary: big score, time per question, list of mistakes with "Add to review" already done, and two buttons:
  "Practise again" and "Back to unit".

### Practice hub

- Top: "Recommended for you" — weakest tags drill and due reviews — as large cards with one button each.
- Then three part cards (Maths / Logic / Algorithmic) with "Quick set", "Exam pace", "Diagnostic".
- Mocks section: CST and TU/e cards with "Start a new mock", the two written mocks, and the last score + readiness.

### Plan (schedule)

- Default view "This week": days as columns on desktop, stacked on phones; today highlighted; tasks as checkable rows
  with a coloured left border by type (learn, practice, test, review, mock).
- Keep "All weeks" and "Calendar" as secondary views. Put the key-dates strip here.

### Progress (analytics)

- Lead with three charts: accuracy by part over time, hours studied vs plan, mock score trend with readiness bands.
- Then "Your weakest topics" as a ranked list with a "Drill" button each; the per-unit table last.

## Visual system

- **Type scale:** 14 / 16 / 18 / 22 / 28 / 36 px; body 16 px (18 px in question text); line-height 1.6 for reading.
- **Spacing:** 4-px grid; section spacing 32 px; card padding 20–24 px.
- **Radius:** 12 px cards, 10 px buttons, 999 px chips.
- **Colour tokens** (keep existing CSS variables): `--accent` for primary actions only, `--good`, `--bad`, `--warn`,
  neutral surfaces. Part colours (maths = sky, logic = violet, algorithmic = emerald) only on small badges and the left
  border of tasks.
- **Elevation:** flat cards with 1-px borders; the primary hero card may use a subtle accent-tinted background.
- **Icons:** simple inline SVG line icons (no icon font dependency) for nav and task types.
- **Motion:** 150–200 ms ease for hover/press; no motion when `prefers-reduced-motion`.

## Acceptance criteria

- Navigation has ≤ 5 primary items on desktop and a bottom tab bar on phones (≤ 640 px); no horizontal overflow at
  375 px on any page.
- The dashboard shows exactly one primary "Next up" button above the fold at 1280×800 and 375×800.
- Unit pages show the four-step learning path; the Learn step text column is ≤ 70 characters wide.
- Question screens have a segmented progress bar, a sticky action bar on phones and ≥ 44 px tap targets.
- All existing Playwright smoke flows still pass (update selectors only where labels changed); lint and typecheck clean.
- Light and dark mode both meet AA contrast for text and focus indicators.

## Out of scope

- Changing question content, the schedule algorithm, scoring or storage.
- New dependencies (no UI kits, no icon packages); use Tailwind and inline SVG.
