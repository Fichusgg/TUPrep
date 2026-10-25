"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { bankForUnit, PART_BY_ID, RESOURCE_BY_ID, UNIT_BY_ID, UNIT_TESTS } from "@/content";
import type { Question } from "@/content/schema";
import { QuestionLog, TutorChat } from "@/components/AskPanel";
import { ErrorList } from "@/components/ErrorList";
import { PracticeSession } from "@/components/PracticeSession";
import { ResourceItem } from "@/components/ResourceItem";
import { RichText } from "@/components/RichText";
import { Badge, Button, Card, ExamBadge, PartBadge, Stat, Tabs } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";
import { createRng, randomSeed } from "@/lib/rng";
import { createUnitTest } from "@/lib/runs";
import { apStatus, todayIso } from "@/lib/schedule";
import { byUnit } from "@/lib/stats";
import { setActiveRun, useAppState, useHydrated } from "@/lib/store";
import { useClock } from "@/lib/useClock";

type Tab = "overview" | "practice" | "test" | "ask" | "errors";

export function UnitTabs({ unitId, summary }: { unitId: string; summary: string }) {
  const unit = UNIT_BY_ID[unitId];
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const state = useAppState();
  const tab = (params.get("tab") as Tab) ?? "overview";
  const setTab = (t: Tab) => router.replace(`/units/${unitId}${t === "overview" ? "" : `?tab=${t}`}`, { scroll: false });
  const openErrors = Object.values(state.errors).filter((e) => e.unit === unitId && !e.resolved).length;
  const openAsk = state.ask.filter((a) => a.unit === unitId && a.status === "open").length;
  const ap = unit.part === "math" && hydrated ? apStatus(unitId, todayIso()) : null;
  const now = useClock();

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

      <Tabs<Tab>
        label="Unit sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "practice", label: "Practice" },
          { id: "test", label: "Timed test" },
          { id: "ask", label: "Ask", count: openAsk },
          { id: "errors", label: "My errors", count: openErrors },
        ]}
      />

      {tab === "overview" && <Overview unitId={unitId} summary={summary} apNote={ap?.note} />}
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
      {tab === "errors" && hydrated && <ErrorList unit={unitId} now={now} />}
    </div>
  );
}

function Overview({ unitId, summary, apNote }: { unitId: string; summary: string; apNote?: string }) {
  const unit = UNIT_BY_ID[unitId];
  const { attempts } = useAppState();
  const t = byUnit(attempts, unitId);
  const bank = bankForUnit(unitId);
  const avgEst = bank.reduce((s, q) => s + q.estSeconds, 0) / bank.length;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <RichText text={summary} />
        {apNote && <p className="mt-4 rounded-md bg-surface-2 p-3 text-xs text-muted">AP Calculus BC: {apNote}</p>}
        <p className="mt-4 text-xs text-muted">Summary written for TUPrep (original text).</p>
      </Card>
      <aside className="space-y-4">
        <Card className="grid grid-cols-2 gap-4">
          <Stat label="Answered" value={t.attempts} />
          <Stat label="Accuracy" value={t.attempts ? `${t.accuracy}%` : "—"} />
          <Stat label="Avg time" value={t.attempts ? formatDuration(t.avgMs) : "—"} hint={`target ≈ ${Math.round(avgEst)} s`} />
          <Stat label="Bank" value={bank.length} hint="questions" />
        </Card>
        <section className="space-y-3">
          <h2 className="font-semibold">Resources for this unit</h2>
          {unit.resources.map((rid) => RESOURCE_BY_ID[rid] && <ResourceItem key={rid} r={RESOURCE_BY_ID[rid]} />)}
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
  const [session, setSession] = useState<Question[] | null>(null);
  const seen = useMemo(() => new Set(attempts.map((a) => a.qid)), [attempts]);

  const pool = bank.filter((q) => {
    if (mode === "challenge" && q.difficulty !== 3) return false;
    if (mode === "missed" && !(errors[q.id] && !errors[q.id].resolved)) return false;
    if (mode === "bookmarks" && !bookmarks.includes(q.id)) return false;
    if (diffs.length && mode !== "challenge" && !diffs.includes(q.difficulty)) return false;
    if (tags.length && !q.tags.some((t) => tags.includes(t))) return false;
    return true;
  });

  const start = () => {
    const rng = createRng(randomSeed());
    const fresh = rng.shuffle(pool.filter((q) => !seen.has(q.id)));
    const old = rng.shuffle(pool.filter((q) => seen.has(q.id)));
    setSession([...fresh, ...old].slice(0, count));
  };

  if (session)
    return (
      <PracticeSession
        key={session.map((q) => q.id).join()}
        questions={session}
        mode={mode === "challenge" ? "challenge" : mode === "missed" ? "review" : "practice"}
        title={`${unitId} · ${mode === "challenge" ? "Challenge (hard only)" : mode === "missed" ? "Review of missed questions" : mode === "bookmarks" ? "Bookmarked" : "Practice"}`}
        paceSeconds={paced ? scheduleConfig.pace[UNIT_BY_ID[unitId].part] : undefined}
        onExit={() => setSession(null)}
        onRestart={start}
      />
    );

  const chip = (active: boolean, onClick: () => void, label: string, key: string) => (
    <button key={key} type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-3 py-1 text-sm ${active ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`}>
      {label}
    </button>
  );

  return (
    <Card className="space-y-5">
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
          Topic tags <span className="font-normal text-muted">(none = all)</span>
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
          <input type="checkbox" checked={paced} onChange={(e) => setPaced(e.target.checked)} /> Show exam-pace timer ({scheduleConfig.pace[UNIT_BY_ID[unitId].part]} s / question)
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          {pool.length} matching questions ({pool.filter((q) => !seen.has(q.id)).length} not seen yet).
        </p>
        <Button onClick={start} disabled={pool.length === 0}>
          Start
        </Button>
      </div>
    </Card>
  );
}

function TimedTest({ unitId }: { unitId: string }) {
  const router = useRouter();
  const { runs, activeRun } = useAppState();
  const def = UNIT_TESTS.find((t) => t.unit === unitId)!;
  const part = UNIT_BY_ID[unitId].part;
  const [count, setCount] = useState(def.count);
  const [ngb, setNgb] = useState(def.noGoingBackDefault);
  const history = runs.filter((r) => r.kind === "unit-test" && r.unit === unitId).reverse();
  const minutes = Math.round((count * scheduleConfig.pace[part]) / 60);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="space-y-4">
        <h2 className="font-semibold">{def.title}</h2>
        <p className="text-sm text-muted">
          Drawn from the {unitId} bank with a 30/45/25 difficulty mix (unseen questions first). Time budget = questions × the exam pace for{" "}
          {PART_BY_ID[part].short} ({scheduleConfig.pace[part]} s, {scheduleConfig.paceStatus.toLowerCase()} from the official section lengths). The timer cannot be
          paused, survives reloads and submits at zero.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm">
            Questions{" "}
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="ml-1 rounded-md border border-line bg-surface px-2 py-1">
              {[5, 10, 12, 13, 14, 15, 20, 25].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ngb} onChange={(e) => setNgb(e.target.checked)} /> No going back (mimics the CST)
          </label>
          <span className="tabular text-sm text-muted">Time: {minutes} min</span>
        </div>
        <Button
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
        <h2 className="font-semibold">Previous attempts</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No attempts yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {history.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <Link className="hover:underline" href={`/results/${encodeURIComponent(r.id)}`}>
                  {formatDate(r.finishedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Link>
                <span className="tabular font-medium">{r.score}%</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
