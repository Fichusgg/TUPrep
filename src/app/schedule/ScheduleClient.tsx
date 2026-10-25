"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { KeyDatesStrip } from "@/components/KeyDatesStrip";
import { Badge, Button, Card, PageHeader, ProgressBar, Tabs } from "@/components/ui";
import { evaluateCheckpoint } from "@/lib/checkpoints";
import { formatDate } from "@/lib/format";
import { addDaysIso, buildSchedule, effectiveDate, mondayOf, rescheduleFrom, todayIso, weekIndexFor, type Task, type Week } from "@/lib/schedule";
import { setTaskOverrides, toggleTask, useAppState, useHydrated } from "@/lib/store";

type View = "week" | "all" | "calendar";

const KIND_LABEL: Partial<Record<Task["kind"], string>> = {
  "timed-test": "timed test",
  "mock-review": "mock review",
  "test-day": "TEST",
};

export function TaskRow({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const { tasksDone } = useAppState();
  const done = Boolean(tasksDone[task.id]);
  return (
    <li className="flex items-start gap-3 py-2">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" checked={done} onChange={() => toggleTask(task.id)} aria-label={`Mark "${task.title}" done`} />
      <div className="min-w-0 flex-1">
        <Link href={task.href} className={`text-sm hover:underline ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
          {showDate && <span>{formatDate(task.date, { weekday: "short", day: "numeric", month: "short" })}</span>}
          <span>{task.minutes} min</span>
          <span>{KIND_LABEL[task.kind] ?? task.kind}</span>
          {task.unit && <span>{task.unit}</span>}
        </div>
      </div>
    </li>
  );
}

function WeekCard({ w, tasks, today, open }: { w: Week; tasks: Task[]; today: string; open: boolean }) {
  const { tasksDone, taskOverrides, attempts, runs } = useAppState();
  const done = tasks.filter((t) => tasksDone[t.id]).length;
  const minutes = tasks.reduce((s, t) => s + t.minutes, 0);
  const cp = evaluateCheckpoint(w, attempts, runs, today);
  const past = today > w.end;
  const missed = past && done < tasks.length;
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) byDay.set(effectiveDate(t, taskOverrides), [...(byDay.get(effectiveDate(t, taskOverrides)) ?? []), t]);
  const current = today >= w.start && today <= w.end;

  return (
    <details open={open} className={`rounded-xl border bg-surface ${current ? "border-accent" : "border-line"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <span className="font-semibold">Week {w.index + 1}</span>
        <span className="text-sm text-muted">
          {formatDate(w.start, { day: "numeric", month: "short" })} – {formatDate(w.end, { day: "numeric", month: "short" })}
        </span>
        <Badge tone="info">{w.phase.id} · {w.phase.title}</Badge>
        {w.kind !== "normal" && <Badge tone={w.kind === "heavy" ? "warn" : "muted"}>{w.kind === "heavy" ? `heavy${w.optionalExtra ? " (optional)" : ""}` : "lighter week"}</Badge>}
        <span className="tabular ml-auto text-xs text-muted">
          {w.hours} h budget · {(minutes / 60).toFixed(1)} h planned · {done}/{tasks.length} done
        </span>
      </summary>
      <div className="space-y-4 border-t border-line p-4">
        {w.focus.length > 0 && (
          <p className="text-sm">
            <span className="text-muted">Focus: </span>
            {w.focus.map((u, i) => (
              <span key={u}>
                {i > 0 && ", "}
                <Link className="underline underline-offset-2" href={`/units/${u}`}>
                  {u}
                </Link>
              </span>
            ))}
          </p>
        )}
        {w.notes.map((n) => (
          <p key={n} className="text-xs text-muted">
            {n}
          </p>
        ))}
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {[...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, ts]) => (
              <div key={day}>
                <h4 className={`mt-2 text-xs font-semibold uppercase tracking-wide ${day === today ? "text-accent" : "text-muted"}`}>{formatDate(day, { weekday: "long", day: "numeric", month: "short" })}</h4>
                <ul className="divide-y divide-line">
                  {ts.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </ul>
              </div>
            ))}
        </div>
        <div className={`rounded-lg border p-3 text-sm ${cp.status === "met" ? "border-good/40 bg-good-soft" : cp.status === "not-met" ? "border-bad/40 bg-bad-soft" : "border-line bg-surface-2"}`}>
          <span className="font-medium">Checkpoint: </span>
          {w.checkpoint.text}
          <span className="block text-xs text-muted">
            {cp.status === "met" ? "✓ Met — " : cp.status === "not-met" ? "✗ Not met — " : ""}
            {cp.detail}
          </span>
        </div>
        {missed && <RescheduleButton fromIndex={w.index} />}
      </div>
    </details>
  );
}

function RescheduleButton({ fromIndex }: { fromIndex: number }) {
  const { tasksDone, taskOverrides } = useAppState();
  const weeks = useMemo(() => buildSchedule(), []);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
      <span>This week has unfinished tasks.</span>
      <Button
        variant="secondary"
        onClick={() => {
          if (window.confirm("Shift all unfinished tasks from this week onward forward by one week? Test days and taper days stay fixed.")) setTaskOverrides(rescheduleFrom(weeks, fromIndex, tasksDone, taskOverrides));
        }}
      >
        Reschedule remaining tasks
      </Button>
    </div>
  );
}

function MonthCalendar({ tasks, today }: { tasks: Task[]; today: string }) {
  const { taskOverrides, tasksDone, keyDates } = useAppState();
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDaysIso(gridStart, i));
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) byDay.set(effectiveDate(t, taskOverrides), [...(byDay.get(effectiveDate(t, taskOverrides)) ?? []), t]);
  const marks = new Map<string, string[]>();
  for (const t of scheduleConfig.tests) marks.set(t.date, [...(marks.get(t.date) ?? []), t.label]);
  for (const k of [...scheduleConfig.keyDates, ...keyDates]) marks.set(k.date, [...(marks.get(k.date) ?? []), k.label]);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
          ←
        </Button>
        <h2 className="flex-1 text-center font-semibold">{formatDate(first, { month: "long", year: "numeric" })}</h2>
        <Button variant="ghost" onClick={() => shift(1)} aria-label="Next month">
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const ts = byDay.get(d) ?? [];
          const doneN = ts.filter((t) => tasksDone[t.id]).length;
          const mins = ts.reduce((s, t) => s + t.minutes, 0);
          const inMonth = d.startsWith(month);
          const mk = marks.get(d);
          const test = ts.some((t) => t.kind === "test-day");
          return (
            <div
              key={d}
              title={[...(mk ?? []), ...ts.map((t) => `• ${t.title}`)].join("\n")}
              className={`min-h-16 rounded-md border p-1 text-left text-[11px] ${d === today ? "border-accent" : "border-line"} ${inMonth ? "bg-surface" : "bg-surface-2 opacity-50"} ${test ? "bg-accent-soft" : ""}`}
            >
              <div className="tabular font-medium">{Number(d.slice(8))}</div>
              {ts.length > 0 && (
                <div className="text-muted">
                  {doneN}/{ts.length} · {mins}m
                </div>
              )}
              {mk && <div className="truncate font-medium text-accent">{mk[0]}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Hover a day to see its tasks. Sundays are rest days.</p>
    </Card>
  );
}

export function ScheduleClient() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const router = useRouter();
  const { tasksDone, taskOverrides } = useAppState();
  const weeks = useMemo(() => buildSchedule(), []);
  const view = (params.get("view") as View) ?? "week";
  const today = todayIso();
  const all = useMemo(() => weeks.flatMap((w) => w.tasks), [weeks]);
  // Tasks are grouped by their effective (possibly rescheduled) week.
  const tasksFor = (w: Week) => all.filter((t) => {
    const d = effectiveDate(t, taskOverrides);
    return d >= w.start && d <= w.end;
  });

  if (!hydrated) return null;
  const wi = weekIndexFor(weeks, today);
  const thisWeek = weeks[wi];
  const todays = all.filter((t) => effectiveDate(t, taskOverrides) === today);
  const totalDone = all.filter((t) => tasksDone[t.id]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={`Week-by-week plan from ${formatDate(scheduleConfig.startDate)} to your last test, generated from config/schedule.config.ts (${scheduleConfig.hours.normal} h normal, ${scheduleConfig.hours.heavy} h heavy weeks, Sunday rest, one lighter week a month).`}
        actions={<Badge tone="info">{totalDone}/{all.length} tasks done</Badge>}
      />
      <KeyDatesStrip editable />
      <Tabs<View>
        label="Schedule view"
        value={view}
        onChange={(v) => router.replace(`/schedule${v === "week" ? "" : `?view=${v}`}`, { scroll: false })}
        tabs={[
          { id: "week", label: "Today & this week" },
          { id: "all", label: "All weeks" },
          { id: "calendar", label: "Calendar" },
        ]}
      />
      {view === "week" && (
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Today · {formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</h2>
            {todays.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{today < scheduleConfig.startDate ? `The plan starts on ${formatDate(scheduleConfig.startDate)}.` : "Nothing scheduled today — rest, or clear your review queue."}</p>
            ) : (
              <>
                <ProgressBar value={(todays.filter((t) => tasksDone[t.id]).length / todays.length) * 100} label="Today's tasks done" />
                <ul className="mt-2 divide-y divide-line">
                  {todays.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </ul>
              </>
            )}
          </Card>
          {thisWeek && <WeekCard w={thisWeek} tasks={tasksFor(thisWeek)} today={today} open />}
        </div>
      )}
      {view === "all" && (
        <div className="space-y-3">
          {Object.keys(taskOverrides).length > 0 && (
            <p className="text-sm text-muted">
              {Object.keys(taskOverrides).length} task(s) rescheduled.{" "}
              <button type="button" className="underline" onClick={() => window.confirm("Undo all rescheduling?") && setTaskOverrides({})}>
                Undo all
              </button>
            </p>
          )}
          {weeks.map((w) => (
            <WeekCard key={w.index} w={w} tasks={tasksFor(w)} today={today} open={w.index === wi} />
          ))}
        </div>
      )}
      {view === "calendar" && <MonthCalendar tasks={all} today={today} />}
    </div>
  );
}
