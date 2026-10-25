"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { bankForUnit, PART_BY_ID, RESOURCE_BY_ID, UNIT_BY_ID, UNIT_TESTS } from "@/content";
import type { Question } from "@/content/schema";
import { QuestionLog, TutorChat } from "@/components/AskPanel";
import { ErrorList } from "@/components/ErrorList";
import { IconArrow, IconBulb, IconCheck, IconWarn } from "@/components/Icons";
import { PracticeSession } from "@/components/PracticeSession";
import { ResourceItem } from "@/components/ResourceItem";
import { RichText } from "@/components/RichText";
import { Badge, Button, ButtonLink, Card, ExamBadge, PartBadge } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";
import { PASS_MARK, unitProgress } from "@/lib/progress";
import { createRng, randomSeed } from "@/lib/rng";
import { createUnitTest } from "@/lib/runs";
import { apStatus, todayIso } from "@/lib/schedule";
import { byUnit } from "@/lib/stats";
import { setActiveRun, useAppState, useHydrated } from "@/lib/store";
import { useClock } from "@/lib/useClock";

type Tab = "overview" | "practice" | "test" | "errors" | "ask";

/** Split the unit markdown into its "## " sections. */
function sections(md: string) {
  return md
    .split(/^## /m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const nl = s.indexOf("\n");
      return { heading: s.slice(0, nl).trim(), body: s.slice(nl + 1).trim() };
    });
}

export function UnitTabs({ unitId, summary }: { unitId: string; summary: string }) {
  const unit = UNIT_BY_ID[unitId];
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const state = useAppState();
  const tab = (params.get("tab") as Tab) ?? "overview";
  const setTab = (t: Tab) => router.replace(`/units/${unitId}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  const prog = unitProgress(state, unit);
  const openAsk = state.ask.filter((a) => a.unit === unitId && a.status === "open").length;
  const ap = unit.part === "math" && hydrated ? apStatus(unitId, todayIso()) : null;
  const now = useClock();

  const steps: { id: Tab; label: string; hint: string; done: boolean }[] = [
    { id: "overview", label: "Learn", hint: "Key ideas & traps", done: prog.seen > 0 },
    { id: "practice", label: "Practice", hint: `${prog.seen}/${prog.total} seen`, done: prog.seen >= 10 },
    { id: "test", label: "Timed test", hint: prog.bestTest !== null ? `best ${prog.bestTest}%` : `pass at ${PASS_MARK}%`, done: prog.status === "passed" },
    { id: "errors", label: "Review", hint: prog.openErrors ? `${prog.openErrors} open` : "no open mistakes", done: prog.seen > 0 && prog.openErrors === 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/units" className="text-sm text-muted hover:text-fg">
          ← All units
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PartBadge part={unit.part}>{PART_BY_ID[unit.part].title}</PartBadge>
          {unit.relevance.map((r) => (
            <ExamBadge key={r} exam={r} />
          ))}
          {ap && (
            <Badge tone={ap.tone === "good" ? "good" : ap.tone === "warn" ? "warn" : "info"} title={ap.note}>
              {ap.label}
            </Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {unit.id} · {unit.title}
        </h1>
        <p className="mt-1 max-w-3xl text-muted">{unit.covers}</p>
      </div>

      {/* Learning-path stepper */}
      <div className="flex flex-wrap items-stretch gap-2">
        <ol role="tablist" aria-label="Learning path" className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s, i) => {
            const active = tab === s.id;
            return (
              <li key={s.id} className="contents">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(s.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/50"}`}
                >
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${s.done && hydrated ? "bg-good text-white dark:text-bg" : active ? "bg-accent text-white dark:text-bg" : "bg-surface-2 text-muted"}`}
                  >
                    {s.done && hydrated ? <IconCheck className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block truncate text-xs text-muted">{hydrated ? s.hint : " "}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ask"}
          onClick={() => setTab("ask")}
          className={`rounded-xl border px-4 py-2.5 text-sm ${tab === "ask" ? "border-accent bg-accent-soft font-medium" : "border-line bg-surface text-muted hover:text-fg"}`}
        >
          Ask{openAsk > 0 && <span className="tabular ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs">{openAsk}</span>}
        </button>
      </div>

      {tab === "overview" && <Overview unitId={unitId} summary={summary} apNote={ap?.note} onPractise={() => setTab("practice")} />}
      {tab === "practice" && hydrated && <Practice unitId={unitId} initialMode={params.get("mode")} />}
      {tab === "test" && hydrated && <TimedTest unitId={unitId} />}
      {tab === "ask" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-semibold">My questions</h2>
            <QuestionLog unit={unitId} />
          </section>
          <section>
            <h2 className="mb-3 font-semibold">Tutor</h2>
            <TutorChat unit={unitId} />
          </section>
        </div>
      )}
      {tab === "errors" && hydrated && (
        <div className="space-y-4">
          <p className="max-w-prose text-sm text-muted">
            Every question you miss in this unit lands here and comes back in your review queue after 1, 3, 7 and 21 days. Tag why you missed it — that tells you what to fix.
          </p>
          <ErrorList unit={unitId} now={now} />
        </div>
      )}
    </div>
  );
}

function Overview({ unitId, summary, apNote, onPractise }: { unitId: string; summary: string; apNote?: string; onPractise: () => void }) {
  const unit = UNIT_BY_ID[unitId];
  const { attempts, resourcesDone } = useAppState();
  const t = byUnit(attempts, unitId);
  const bank = bankForUnit(unitId);
  const avgEst = bank.reduce((s, q) => s + q.estSeconds, 0) / bank.length;
  const parts = sections(summary);
  const done = unit.resources.filter((r) => resourcesDone[r]).length;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="max-w-prose space-y-6">
        {parts.map((p) => {
          const trap = /trap/i.test(p.heading);
          return (
            <section key={p.heading} className={`rounded-2xl border p-5 md:p-6 ${trap ? "border-warn/30 bg-warn/5" : "border-accent/20 bg-accent-soft/50"}`}>
              <h2 className={`mb-3 flex items-center gap-2 text-lg font-semibold ${trap ? "text-warn" : "text-accent"}`}>
                {trap ? <IconWarn /> : <IconBulb />}
                {p.heading}
              </h2>
              <RichText text={p.body} className="text-[17px] leading-[1.7] text-fg" />
            </section>
          );
        })}
        {apNote && <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">AP Calculus BC: {apNote}</p>}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button onClick={onPractise} className="px-5 py-2.5 text-base">
            I&apos;ve read this — practise <IconArrow className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted">Summary written for TUPrep (original text).</span>
        </div>
      </article>
      <aside className="space-y-4">
        <Card className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <div className="tabular text-xl font-semibold">{t.attempts}</div>
            <div className="text-xs text-muted">answered</div>
          </div>
          <div>
            <div className="tabular text-xl font-semibold">{t.attempts ? `${t.accuracy}%` : "—"}</div>
            <div className="text-xs text-muted">correct</div>
          </div>
          <div>
            <div className="tabular text-xl font-semibold">{t.attempts ? formatDuration(t.avgMs) : "—"}</div>
            <div className="text-xs text-muted">avg · aim {Math.round(avgEst)}s</div>
          </div>
        </Card>
        <section className="space-y-3">
          <h2 className="flex items-baseline gap-2 font-semibold">
            Resources <span className="tabular text-xs font-normal text-muted">{done}/{unit.resources.length} done</span>
          </h2>
          {unit.resources.map((rid) => RESOURCE_BY_ID[rid] && <ResourceItem key={rid} r={RESOURCE_BY_ID[rid]} compact />)}
        </section>
      </aside>
    </div>
  );
}

type PMode = "untimed" | "challenge" | "missed" | "bookmarks";

function Practice({ unitId, initialMode }: { unitId: string; initialMode: string | null }) {
  const { attempts, errors, bookmarks } = useAppState();
  const bank = useMemo(() => bankForUnit(unitId), [unitId]);
  const allTags = useMemo(() => [...new Set(bank.flatMap((q) => q.tags))].sort(), [bank]);
  const [mode, setMode] = useState<PMode>(initialMode === "challenge" ? "challenge" : "untimed");
  const [diffs, setDiffs] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [paced, setPaced] = useState(false);
  const [session, setSession] = useState<{ qs: Question[]; mode: PMode } | null>(null);
  const seen = useMemo(() => new Set(attempts.map((a) => a.qid)), [attempts]);
  const missed = bank.filter((q) => errors[q.id] && !errors[q.id].resolved);

  const poolFor = (m: PMode, custom: boolean) =>
    bank.filter((q) => {
      if (m === "challenge" && q.difficulty !== 3) return false;
      if (m === "missed" && !(errors[q.id] && !errors[q.id].resolved)) return false;
      if (m === "bookmarks" && !bookmarks.includes(q.id)) return false;
      if (custom && diffs.length && m !== "challenge" && !diffs.includes(q.difficulty)) return false;
      if (custom && tags.length && !q.tags.some((t) => tags.includes(t))) return false;
      return true;
    });

  const start = (m: PMode, n: number, custom = false) => {
    const pool = poolFor(m, custom);
    const rng = createRng(randomSeed());
    const fresh = rng.shuffle(pool.filter((q) => !seen.has(q.id)));
    const old = rng.shuffle(pool.filter((q) => seen.has(q.id)));
    // Easier questions first within a fresh set, so a session ramps up.
    const qs = [...fresh, ...old].slice(0, n).sort((a, b) => (m === "untimed" && !custom ? a.difficulty - b.difficulty : 0));
    setSession({ qs, mode: m });
  };

  if (session)
    return (
      <PracticeSession
        key={session.qs.map((q) => q.id).join()}
        questions={session.qs}
        mode={session.mode === "challenge" ? "challenge" : session.mode === "missed" ? "review" : "practice"}
        title={`${unitId} · ${session.mode === "challenge" ? "Challenge (hard only)" : session.mode === "missed" ? "Your missed questions" : session.mode === "bookmarks" ? "Bookmarked" : "Practice"}`}
        paceSeconds={paced ? scheduleConfig.pace[UNIT_BY_ID[unitId].part] : undefined}
        onExit={() => setSession(null)}
        onRestart={() => start(session.mode, session.qs.length)}
      />
    );

  const chip = (active: boolean, onClick: () => void, label: string, key: string) => (
    <button key={key} type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`}>
      {label}
    </button>
  );
  const unseen = bank.filter((q) => !seen.has(q.id)).length;
  const pool = poolFor(mode, true);

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Practise {unitId}</h2>
          <p className="text-sm text-muted">
            10 questions, easiest first, with hints and worked solutions. {unseen} of {bank.length} questions are still new to you.
          </p>
        </div>
        <Button onClick={() => start("untimed", 10)} className="px-5 py-2.5 text-base">
          Practise 10 questions <IconArrow className="h-4 w-4" />
        </Button>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => start("challenge", 8)} className="rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent">
          <span className="block font-medium">Challenge — 8 hard questions</span>
          <span className="text-sm text-muted">Level 3 only. Good once the basics feel easy.</span>
        </button>
        <button type="button" disabled={!missed.length} onClick={() => start("missed", 15)} className="rounded-xl border border-line bg-surface p-4 text-left transition hover:border-accent disabled:opacity-50">
          <span className="block font-medium">Redo my mistakes ({missed.length})</span>
          <span className="text-sm text-muted">{missed.length ? "Questions from this unit you got wrong." : "Nothing to redo yet."}</span>
        </button>
      </div>

      <details className="rounded-xl border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Customise a set (difficulty, topics, timer)</summary>
        <div className="space-y-5 border-t border-line p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Mode</legend>
            <div className="flex flex-wrap gap-2">
              {chip(mode === "untimed", () => setMode("untimed"), "Untimed practice", "m1")}
              {chip(mode === "challenge", () => setMode("challenge"), "Challenge (hard only)", "m2")}
              {chip(mode === "missed", () => setMode("missed"), "Review missed", "m3")}
              {chip(mode === "bookmarks", () => setMode("bookmarks"), "Bookmarked", "m4")}
            </div>
          </fieldset>
          {mode !== "challenge" && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Difficulty</legend>
              <div className="flex flex-wrap gap-2">{[1, 2, 3].map((d) => chip(diffs.includes(d), () => setDiffs((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d])), ["Level 1", "Level 2", "Level 3"][d - 1], `d${d}`))}</div>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Topics <span className="font-normal text-muted">(none = all)</span>
            </legend>
            <div className="flex flex-wrap gap-2">{allTags.map((t) => chip(tags.includes(t), () => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t])), t, t))}</div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm">
              Questions{" "}
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="ml-1 rounded-md border border-line bg-surface px-2 py-1">
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paced} onChange={(e) => setPaced(e.target.checked)} /> Exam-pace timer ({scheduleConfig.pace[UNIT_BY_ID[unitId].part]} s per question)
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-muted">
              {pool.length} matching ({pool.filter((q) => !seen.has(q.id)).length} new).
            </p>
            <Button variant="secondary" onClick={() => start(mode, count, true)} disabled={pool.length === 0}>
              Start custom set
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function TimedTest({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { runs, activeRun } = useAppState();
  const def = UNIT_TESTS.find((t) => t.unit === unitId)!;
  const part = UNIT_BY_ID[unitId].part;
  const [count, setCount] = useState(def.count);
  const [ngb, setNgb] = useState(def.noGoingBackDefault);
  const history = runs.filter((r) => r.kind === "unit-test" && r.unit === unitId);
  const minutes = Math.round((count * scheduleConfig.pace[part]) / 60);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Timed test: {unitId}</h2>
            <p className="text-sm text-muted">Pass mark {PASS_MARK}% — that ticks this unit off.</p>
          </div>
          <div className="text-right">
            <div className="tabular text-3xl font-semibold">{minutes} min</div>
            <div className="text-xs text-muted">{count} questions · exam pace</div>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>• Questions come from the {unitId} bank (new ones first), easiest first.</li>
          <li>• The timer can&apos;t be paused, keeps running if you reload, and submits at zero.</li>
          <li>• {ngb ? "No going back: like the CST, you can't return to earlier questions." : "You can move freely between questions."}</li>
        </ul>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Options</summary>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label>
              Questions{" "}
              <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="ml-1 rounded-md border border-line bg-surface px-2 py-1">
                {[5, 10, 12, 13, 14, 15, 20, 25].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ngb} onChange={(e) => setNgb(e.target.checked)} /> No going back (mimics the CST)
            </label>
          </div>
        </details>
        <Button
          className="px-5 py-2.5 text-base"
          disabled={Boolean(activeRun)}
          onClick={() => {
            setActiveRun(createUnitTest(unitId, { count, noGoingBack: ngb }));
            router.push("/run");
          }}
        >
          {activeRun ? "Another test is in progress" : "Start timed test"}
        </Button>
      </Card>
      <Card>
        <h2 className="font-semibold">Your scores</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No attempts yet.</p>
        ) : (
          <>
            <div className="relative mt-3 flex h-24 items-end gap-1.5" role="img" aria-label={`Scores: ${history.map((r) => `${r.score}%`).join(", ")}`}>
              <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-good/60" style={{ bottom: `${PASS_MARK}%` }} aria-hidden />
              {history.slice(-10).map((r) => (
                <Link key={r.id} href={`/results/${encodeURIComponent(r.id)}`} className="flex h-full flex-1 flex-col justify-end" title={`${r.score}%`}>
                  <div className={`w-full rounded-t ${r.score >= PASS_MARK ? "bg-good" : "bg-accent"}`} style={{ height: `${Math.max(3, r.score)}%` }} />
                </Link>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-line text-sm">
              {[...history].reverse().map((r) => (
                <li key={r.id} className="flex justify-between py-2">
                  <Link className="hover:underline" href={`/results/${encodeURIComponent(r.id)}`}>
                    {formatDate(r.finishedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Link>
                  <span className={`tabular font-medium ${r.score >= PASS_MARK ? "text-good" : ""}`}>{r.score}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <ButtonLink href={`/units/${unitId}?tab=errors`} variant="ghost" className="mt-2 px-0">
          Review mistakes →
        </ButtonLink>
      </Card>
    </div>
  );
}
