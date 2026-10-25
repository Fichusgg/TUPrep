"use client";

import Link from "next/link";
import { useMemo } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { PARTS, UNIT_BY_ID } from "@/content";
import { IconArrow, IconCheck, IconFlame, IconReview, IconTarget } from "@/components/Icons";
import { TaskRow } from "@/app/schedule/ScheduleClient";
import { Badge, ButtonLink, Card, PartBadge, ProgressBar } from "@/components/ui";
import { evaluateCheckpoint } from "@/lib/checkpoints";
import { formatDate } from "@/lib/format";
import { nextUnit, orderedUnits, unitProgress } from "@/lib/progress";
import { buildSchedule, daysBetween, effectiveDate, todayIso, weekIndexFor, type Task } from "@/lib/schedule";
import { isDue } from "@/lib/srs";
import { streak } from "@/lib/stats";
import { useAppState, useHydrated } from "@/lib/store";
import { useClock } from "@/lib/useClock";

const KIND_VERB: Partial<Record<Task["kind"], string>> = {
  read: "Read",
  resource: "Study",
  prelearn: "Pre-learn",
  practice: "Practise",
  warmup: "Warm up",
  challenge: "Take the challenge",
  "timed-test": "Take the test",
  review: "Review",
  mock: "Start the mock",
  "mock-review": "Review the mock",
  drill: "Start the drill",
  diagnostic: "Start",
  setup: "Open",
  readiness: "Check",
  taper: "Review",
  "test-day": "Good luck",
};

export function Dashboard() {
  const hydrated = useHydrated();
  const state = useAppState();
  const { attempts, errors, runs, tasksDone, taskOverrides, studyLog, activeRun } = state;
  const weeks = useMemo(() => buildSchedule(), []);
  const now = useClock(60_000);
  const today = todayIso(now);
  const all = useMemo(() => weeks.flatMap((w) => w.tasks), [weeks]);
  const todays = all.filter((t) => effectiveDate(t, taskOverrides) === today);
  const week = weeks[weekIndexFor(weeks, today)];
  const due = Object.values(errors).filter((e) => isDue(e, now)).length;
  const days = hydrated ? streak(attempts, studyLog.map((s) => new Date(`${s.date}T12:00:00`).getTime()), now) : 0;
  const doneToday = todays.filter((t) => tasksDone[t.id]).length;
  const cp = week ? evaluateCheckpoint(week, attempts, runs, today) : null;

  // ---- the one thing to do next
  const nextTask = todays.find((t) => !tasksDone[t.id] && t.kind !== "test-day");
  const firstTask = today < scheduleConfig.startDate ? all.find((t) => !tasksDone[t.id]) : undefined;
  let hero: { eyebrow: string; title: string; meta: string; href: string; cta: string; secondary?: { href: string; label: string } };
  if (activeRun) {
    hero = { eyebrow: "In progress", title: activeRun.title, meta: "Its timer keeps running — finish it first.", href: "/run", cta: "Resume test" };
  } else if (nextTask) {
    hero = {
      eyebrow: "Next up today",
      title: nextTask.title,
      meta: `${nextTask.minutes} min${nextTask.unit ? ` · ${nextTask.unit} ${UNIT_BY_ID[nextTask.unit]?.title ?? ""}` : ""}`,
      href: nextTask.href,
      cta: KIND_VERB[nextTask.kind] ?? "Start",
      secondary: due ? { href: "/review", label: `Review ${due} mistake${due === 1 ? "" : "s"}` } : undefined,
    };
  } else if (due) {
    hero = { eyebrow: "Next up", title: `Review ${due} mistake${due === 1 ? "" : "s"}`, meta: "Spaced review keeps what you learned. About 1 minute per question.", href: "/review", cta: "Start review" };
  } else if (firstTask) {
    hero = {
      eyebrow: `Your plan starts ${formatDate(scheduleConfig.startDate, { weekday: "long", day: "numeric", month: "long" })}`,
      title: firstTask.title,
      meta: `${firstTask.minutes} min · you can start early`,
      href: firstTask.href,
      cta: "Start early",
    };
  } else {
    const u = nextUnit(state, "logic") ?? nextUnit(state, "algorithmic");
    hero = {
      eyebrow: todays.length ? "Today is done" : "Rest day",
      title: todays.length ? "Great work — every task for today is ticked off." : "Nothing is scheduled today.",
      meta: "Rest, or do a short extra set if you feel like it.",
      href: u ? `/units/${u.id}?tab=practice` : "/practice",
      cta: "Practise 10 questions",
    };
  }

  const h = new Date(now).getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Countdown strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>{greeting}.</span>
        {hydrated &&
          scheduleConfig.tests.map((t) => {
            const d = daysBetween(today, t.date);
            return (
              <span key={t.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${t.id === "delft-cst" ? "bg-delft" : "bg-tue"}`} aria-hidden />
                {t.id === "delft-cst" ? "TU Delft CST" : "TU/e selection"}{" "}
                <strong className="tabular text-fg">{d > 0 ? `in ${d} days` : d === 0 ? "today" : "done"}</strong>
                {(t.status as string) === "ESTIMATED" && <Badge tone="warn">estimated</Badge>}
              </span>
            );
          })}
      </div>

      {/* Next up */}
      <section aria-labelledby="next-up" className="rounded-2xl border border-accent/30 bg-accent-soft p-6 md:p-8">
        <p className="text-sm font-medium text-accent">{hydrated ? hero.eyebrow : " "}</p>
        <h1 id="next-up" className="mt-1 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
          {hydrated ? hero.title : " "}
        </h1>
        <p className="mt-2 text-muted">{hydrated ? hero.meta : " "}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ButtonLink href={hero.href} className="px-5 py-2.5 text-base">
            {hero.cta} <IconArrow className="h-4 w-4" />
          </ButtonLink>
          {hero.secondary && (
            <Link href={hero.secondary.href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              {hero.secondary.label}
            </Link>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* Today's checklist */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Today</h2>
            {todays.length > 0 && (
              <span className="tabular text-sm text-muted">
                {doneToday} of {todays.length} done
              </span>
            )}
            <Link href="/schedule" className="ml-auto text-sm text-muted hover:text-fg">
              This week →
            </Link>
          </div>
          {!hydrated ? null : todays.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{today < scheduleConfig.startDate ? "Your daily checklist appears here once the plan starts." : "No tasks today."}</p>
          ) : (
            <>
              <div className="mt-3">
                <ProgressBar value={(doneToday / todays.length) * 100} tone={doneToday === todays.length ? "good" : "accent"} label="Today's tasks done" />
              </div>
              {doneToday === todays.length && (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-good">
                  <IconCheck className="h-4 w-4" /> All done for today. Nice.
                </p>
              )}
              <ul className="mt-1 divide-y divide-line">
                {todays.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </>
          )}
        </Card>

        {/* Three tiles */}
        <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Card className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-warn/15 text-warn">
              <IconFlame />
            </span>
            <div>
              <div className="tabular text-xl font-semibold">{days} day{days === 1 ? "" : "s"}</div>
              <div className="text-xs text-muted">study streak</div>
            </div>
          </Card>
          <Link href="/review" className="block">
            <Card className="flex items-center gap-3 p-4 transition hover:border-accent">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
                <IconReview />
              </span>
              <div>
                <div className="tabular text-xl font-semibold">{due}</div>
                <div className="text-xs text-muted">mistakes to review</div>
              </div>
            </Card>
          </Link>
          <Card className="flex items-start gap-3 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cp?.status === "met" ? "bg-good-soft text-good" : "bg-surface-2 text-muted"}`}>
              <IconTarget />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">This week&apos;s goal</div>
              <div className="text-xs text-muted">{week?.checkpoint.text}</div>
              {cp && cp.status !== "manual" && <div className={`mt-1 text-xs ${cp.status === "met" ? "text-good" : "text-muted"}`}>{cp.status === "met" ? "Done ✓" : cp.detail}</div>}
            </div>
          </Card>
        </div>
      </div>

      {/* Learning path */}
      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">Your learning path</h2>
          <Link href="/units" className="ml-auto text-sm text-muted hover:text-fg">
            All units →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PARTS.map((p) => {
            const units = orderedUnits(p.id);
            const prog = hydrated ? units.map((u) => unitProgress(state, u)) : [];
            const passed = prog.filter((x) => x.status === "passed").length;
            const started = prog.filter((x) => x.status !== "not-started").length;
            const answered = prog.reduce((s, x) => s + x.seen, 0);
            const acc = attempts.filter((a) => a.part === p.id);
            const accuracy = acc.length ? Math.round((acc.filter((a) => a.correct).length / acc.length) * 100) : null;
            const nxt = hydrated ? nextUnit(state, p.id) : null;
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <PartBadge part={p.id}>{p.short}</PartBadge>
                  <span className="text-xs text-muted">{p.delft ? "Delft + TU/e" : "TU/e only"}</span>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>
                      {passed} of {units.length} units passed
                    </span>
                    <span className="tabular text-muted">{accuracy !== null ? `${accuracy}% correct` : "—"}</span>
                  </div>
                  <ProgressBar value={((passed + started * 0.35) / units.length) * 100} label={`${p.title} progress`} />
                  <p className="mt-1 text-xs text-muted">{answered} questions answered</p>
                </div>
                {nxt && (
                  <Link href={`/units/${nxt.id}`} className="mt-auto flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:border-accent">
                    <span className="min-w-0 truncate">
                      Continue: <strong>{nxt.id}</strong> {nxt.title}
                    </span>
                    <IconArrow className="h-4 w-4 shrink-0 text-muted" />
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
