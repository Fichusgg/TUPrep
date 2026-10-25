"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bankForUnit, PARTS } from "@/content";
import { Badge, Button, Card, EmptyState, ExamBadge, PageHeader, PartBadge, ProgressBar, Stat } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { readiness } from "@/lib/scoring";
import { buildSchedule, effectiveDate, todayIso } from "@/lib/schedule";
import { byPart, minutesOnSite, streak, unitTable, weakestTags } from "@/lib/stats";
import { addStudyLog, removeStudyLog, useAppState, useHydrated } from "@/lib/store";

function Bars({ rows }: { rows: { label: string; planned: number; done: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.planned, r.done]));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[70px_1fr] items-center gap-2 text-xs">
          <span className="text-muted">{r.label}</span>
          <div className="space-y-0.5">
            <div className="h-2 rounded bg-line" style={{ width: `${(r.planned / max) * 100}%` }} title={`planned ${r.planned.toFixed(1)} h`} />
            <div className="h-2 rounded bg-accent" style={{ width: `${(r.done / max) * 100}%` }} title={`done ${r.done.toFixed(1)} h`} />
          </div>
        </div>
      ))}
      <p className="pt-1 text-xs text-muted">
        <span className="mr-1 inline-block h-2 w-3 rounded bg-line align-middle" />planned <span className="ml-3 mr-1 inline-block h-2 w-3 rounded bg-accent align-middle" />done (ticked tasks + logged study time)
      </p>
    </div>
  );
}

export function AnalyticsClient() {
  const hydrated = useHydrated();
  const { attempts, runs, tasksDone, taskOverrides, studyLog } = useAppState();
  const weeks = useMemo(() => buildSchedule(), []);
  const [mins, setMins] = useState(30);
  const [note, setNote] = useState("");
  if (!hydrated) return null;

  const today = todayIso();
  const units = unitTable(attempts);
  const weak = weakestTags(attempts, 3, 10);
  const all = weeks.flatMap((w) => w.tasks);
  const weekRows = weeks
    .filter((w) => w.start <= today)
    .map((w) => {
      const ts = all.filter((t) => effectiveDate(t, taskOverrides) >= w.start && effectiveDate(t, taskOverrides) <= w.end && t.kind !== "test-day");
      const logged = studyLog.filter((s) => s.date >= w.start && s.date <= w.end).reduce((a, s) => a + s.minutes, 0);
      return { label: `Wk ${w.index + 1}`, planned: ts.reduce((a, t) => a + t.minutes, 0) / 60, done: (ts.filter((t) => tasksDone[t.id]).reduce((a, t) => a + t.minutes, 0) + logged) / 60 };
    });
  const plannedTotal = weekRows.reduce((a, r) => a + r.planned, 0);
  const doneTotal = weekRows.reduce((a, r) => a + r.done, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Accuracy and speed per unit, weakest topic tags, hours studied versus plan, and your mock score trend." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Questions answered" value={attempts.length} /></Card>
        <Card><Stat label="Time on questions" value={`${(minutesOnSite(attempts) / 60).toFixed(1)} h`} /></Card>
        <Card><Stat label="Hours vs plan (to date)" value={`${doneTotal.toFixed(1)} / ${plannedTotal.toFixed(1)}`} /></Card>
        <Card><Stat label="Streak" value={`${streak(attempts, studyLog.map((s) => new Date(`${s.date}T12:00:00`).getTime()))} d`} /></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PARTS.map((p) => {
          const t = byPart(attempts, p.id);
          return (
            <Card key={p.id}>
              <PartBadge part={p.id}>{p.short}</PartBadge>
              <div className="tabular mt-2 text-2xl font-semibold">{t.attempts ? `${t.accuracy}%` : "—"}</div>
              <p className="text-xs text-muted">
                {t.attempts} answered · {t.attempts ? formatDuration(t.avgMs) : "—"} average
              </p>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="font-semibold">Per unit — accuracy and speed</h2>
        {attempts.length === 0 ? (
          <EmptyState title="No answers yet" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4">Unit</th>
                  <th className="py-2 pr-4">Answered</th>
                  <th className="py-2 pr-4">Accuracy</th>
                  <th className="py-2 pr-4">Avg time</th>
                  <th className="py-2 pr-4">Target pace</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const est = bankForUnit(u.unit.id).reduce((s, q) => s + q.estSeconds, 0) / bankForUnit(u.unit.id).length;
                  const slow = u.attempts > 0 && u.avgMs / 1000 > est * 1.25;
                  return (
                    <tr key={u.unit.id} className="border-t border-line">
                      <td className="py-2 pr-4">
                        <Link className="hover:underline" href={`/units/${u.unit.id}`}>
                          {u.unit.id} {u.unit.title}
                        </Link>
                      </td>
                      <td className="tabular py-2 pr-4">{u.attempts}</td>
                      <td className="py-2 pr-4">
                        {u.attempts ? (
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <ProgressBar value={u.accuracy} tone={u.accuracy >= 75 ? "good" : u.accuracy < 50 ? "bad" : "accent"} label={`${u.unit.id} accuracy`} />
                            </div>
                            <span className="tabular">{u.accuracy}%</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`tabular py-2 pr-4 ${slow ? "text-bad" : ""}`}>{u.attempts ? formatDuration(u.avgMs) : "—"}</td>
                      <td className="tabular py-2 pr-4 text-muted">≈ {Math.round(est)} s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Weakest topic tags</h2>
          {weak.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Needs at least 3 answers per tag.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {weak.map((w) => (
                <li key={w.tag} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{w.tag}</span>
                  <span className="text-xs text-muted">{w.units.join(", ")}</span>
                  <Badge tone={w.accuracy < 50 ? "bad" : w.accuracy < 75 ? "warn" : "good"}>
                    {w.accuracy}% of {w.attempts}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {weak.length > 0 && (
            <Link href="/practice?mode=weakest&count=12" className="mt-3 inline-block text-sm text-accent underline">
              Drill these tags →
            </Link>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Hours studied vs plan</h2>
          <div className="mt-3">{weekRows.length ? <Bars rows={weekRows.slice(-10)} /> : <p className="text-sm text-muted">The plan starts on 26 October.</p>}</div>
          <form
            className="mt-4 flex flex-wrap items-end gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              addStudyLog({ date: today, minutes: mins, note });
              setNote("");
            }}
          >
            <label>
              <span className="block text-xs text-muted">Log study time not tracked here (minutes)</span>
              <input type="number" min={5} max={600} value={mins} onChange={(e) => setMins(Number(e.target.value))} className="w-24 rounded-md border border-line bg-surface px-2 py-1" />
            </label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. read FoC 2.3" aria-label="Note" className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1" />
            <Button type="submit" variant="secondary">
              Log
            </Button>
          </form>
          {studyLog.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-muted">
              {[...studyLog].reverse().slice(0, 10).map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span>
                    {s.date} · {s.minutes} min {s.note && `· ${s.note}`}
                  </span>
                  <button type="button" className="ml-auto hover:text-bad" onClick={() => removeStudyLog(s.id)}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Mock score trend</h2>
        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          {(["cst", "tue"] as const).map((f) => {
            const list = runs.filter((r) => r.kind === "mock" && r.format === f);
            const r = readiness(list.map((m) => m.score));
            return (
              <div key={f}>
                <div className="flex items-center gap-2">
                  <ExamBadge exam={f === "cst" ? "delft" : "tue"} />
                  {r && <Badge tone={r.tone === "bad" ? "bad" : r.tone === "warn" ? "warn" : r.tone === "good" ? "good" : "info"}>{r.label}</Badge>}
                </div>
                {list.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No mocks yet.</p>
                ) : (
                  <div className="mt-3 flex h-28 items-end gap-1">
                    {list.map((m) => (
                      <Link key={m.id} href={`/results/${encodeURIComponent(m.id)}`} className="group flex h-full flex-1 flex-col justify-end" title={`${m.title}: ${m.score}%`}>
                        <div className="w-full rounded-t bg-accent group-hover:opacity-80" style={{ height: `${m.score}%` }} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
