"use client";

import Link from "next/link";
import { useMemo } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { bankForUnit, PARTS, UNITS } from "@/content";
import { KeyDatesStrip } from "@/components/KeyDatesStrip";
import { TaskRow } from "@/app/schedule/ScheduleClient";
import { Badge, ButtonLink, Card, ExamBadge, PartBadge, ProgressBar, Stat } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { readiness } from "@/lib/scoring";
import { buildSchedule, daysBetween, effectiveDate, todayIso, weekIndexFor } from "@/lib/schedule";
import { isDue } from "@/lib/srs";
import { byPart, byUnit, streak } from "@/lib/stats";
import { useAppState, useHydrated } from "@/lib/store";
import { useClock } from "@/lib/useClock";

export function Dashboard() {
  const hydrated = useHydrated();
  const { attempts, errors, runs, tasksDone, taskOverrides, studyLog, activeRun } = useAppState();
  const weeks = useMemo(() => buildSchedule(), []);
  const today = todayIso();
  const now = useClock(60_000);
  const all = weeks.flatMap((w) => w.tasks);
  const todays = all.filter((t) => effectiveDate(t, taskOverrides) === today);
  const week = weeks[weekIndexFor(weeks, today)];
  const due = Object.values(errors).filter((e) => isDue(e, now)).length;
  const openErrors = Object.values(errors).filter((e) => !e.resolved).length;
  const days = hydrated ? streak(attempts, studyLog.map((s) => new Date(`${s.date}T12:00:00`).getTime())) : 0;
  const seenByUnit = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of attempts) m.set(a.unit, (m.get(a.unit) ?? new Set()).add(a.qid));
    return m;
  }, [attempts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">CSE selection prep · September 2027 intake</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeRun ? <ButtonLink href="/run">Resume test</ButtonLink> : <ButtonLink href="/schedule">Open schedule</ButtonLink>}
          <ButtonLink href="/review" variant={due ? "primary" : "secondary"}>
            Review queue {due > 0 && `(${due})`}
          </ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {scheduleConfig.tests.map((t) => {
          const d = hydrated ? daysBetween(today, t.date) : null;
          const format = t.id === "delft-cst" ? "cst" : "tue";
          const r = readiness(runs.filter((x) => x.kind === "mock" && x.format === format).map((x) => x.score));
          return (
            <Card key={t.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ExamBadge exam={t.id === "delft-cst" ? "delft" : "tue"} />
                <span className="font-medium">{t.label}</span>
                <Badge tone={t.status === "CONFIRMED" ? "good" : "warn"}>{t.status}</Badge>
              </div>
              <div className="tabular text-3xl font-semibold">{d === null ? " " : d > 0 ? `${d} days` : d === 0 ? "Today" : "Done"}</div>
              <p className="text-xs text-muted">
                {formatDate(t.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {t.parts.map((p) => PARTS.find((x) => x.id === p)!.short).join(" + ")}
              </p>
              <p className="text-xs text-muted">{t.note}</p>
              {r && (
                <p className="text-xs">
                  Readiness: <Badge tone={r.tone === "bad" ? "bad" : r.tone === "warn" ? "warn" : r.tone === "good" ? "good" : "info"}>{r.label}</Badge>
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <KeyDatesStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Today&apos;s tasks</h2>
            {week && (
              <span className="text-xs text-muted">
                Week {week.index + 1} · {week.phase.title}
                {week.focus.length > 0 && ` · focus ${week.focus.join(", ")}`}
              </span>
            )}
            <Link href="/schedule" className="ml-auto text-xs text-muted hover:text-fg">
              Full week →
            </Link>
          </div>
          {!hydrated ? null : todays.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              {today < scheduleConfig.startDate ? `Your plan starts on ${formatDate(scheduleConfig.startDate, { weekday: "long", day: "numeric", month: "long" })}.` : "Nothing scheduled today — a rest day, or clear your review queue."}
            </p>
          ) : (
            <>
              <div className="mt-2">
                <ProgressBar value={(todays.filter((t) => tasksDone[t.id]).length / todays.length) * 100} label="Today's tasks done" />
              </div>
              <ul className="mt-1 divide-y divide-line">
                {todays.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </>
          )}
          {week && <p className="mt-3 rounded-md bg-surface-2 p-2 text-xs text-muted">This week&apos;s checkpoint: {week.checkpoint.text}</p>}
        </Card>
        <Card className="grid grid-cols-2 content-start gap-4">
          <Stat label="Streak" value={`${days} d`} />
          <Stat label="Review queue" value={due} hint={`${openErrors} open errors`} />
          <Stat label="Answered" value={attempts.length} />
          <Stat label="Mocks" value={runs.filter((r) => r.kind === "mock").length} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="font-semibold">Accuracy per part</h2>
          {PARTS.map((p) => {
            const t = hydrated ? byPart(attempts, p.id) : { accuracy: 0, attempts: 0 };
            return (
              <div key={p.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{p.title}</span>
                  <span className="tabular text-muted">{t.attempts ? `${t.accuracy}% · ${t.attempts}` : "—"}</span>
                </div>
                <ProgressBar value={t.accuracy} tone={t.accuracy >= 75 ? "good" : t.attempts > 0 && t.accuracy < 50 ? "bad" : "accent"} label={`${p.title} accuracy`} />
              </div>
            );
          })}
          <p className="text-xs text-muted">Weights — TU Delft CST: Maths 50%, SR&amp;LT 50%. TU/e: Maths 10%, Logic 40%, Algorithmic 40% (+ VWO 10%).</p>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Progress per unit</h2>
          <p className="text-xs text-muted">Bar = share of the unit&apos;s bank you have seen; number = accuracy.</p>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {UNITS.map((u) => {
              const seen = seenByUnit.get(u.id)?.size ?? 0;
              const total = bankForUnit(u.id).length;
              const t = byUnit(attempts, u.id);
              return (
                <Link key={u.id} href={`/units/${u.id}`} className="-m-1 block rounded p-1 hover:bg-surface-2">
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <PartBadge part={u.part}>{u.id}</PartBadge>
                    <span className="min-w-0 flex-1 truncate">{u.title}</span>
                    <span className="tabular text-xs text-muted">{t.attempts ? `${t.accuracy}%` : "—"}</span>
                  </div>
                  <ProgressBar value={(seen / total) * 100} label={`${u.id} progress`} />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
