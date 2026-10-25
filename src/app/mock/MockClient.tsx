"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { BLUEPRINTS, GENERATED_MOCKS, WRITTEN_MOCKS } from "@/content";
import { Badge, Button, Card, EmptyState, ExamBadge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { createGeneratedMock, createWrittenMock } from "@/lib/runs";
import { readiness } from "@/lib/scoring";
import { setActiveRun, uid, useAppState, useHydrated, type ActiveRun } from "@/lib/store";

function Trend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 260;
  const h = 70;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - (p / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[70px] w-full" role="img" aria-label={`Score trend: ${points.join("%, ")}%`}>
      {[50, 65, 80].map((y) => (
        <line key={y} x1="0" x2={w} y1={h - (y / 100) * h} y2={h - (y / 100) * h} className="stroke-line" strokeDasharray="3 4" />
      ))}
      <path d={d} fill="none" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / 100) * h} r="3" className="fill-accent" />
      ))}
    </svg>
  );
}

export function MockClient() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { runs, activeRun } = useAppState();
  const mocks = useMemo(() => runs.filter((r) => r.kind === "mock"), [runs]);

  const launch = (run: ActiveRun) => {
    setActiveRun(run);
    router.push("/run");
  };
  const generate = (format: "cst" | "tue") => {
    const { run, repeats } = createGeneratedMock(format);
    if (repeats > 0 && !window.confirm(`Only ${run.sections.reduce((s, x) => s + x.items.length, 0) - repeats} unseen questions fit the blueprint; ${repeats} question(s) you have already seen will be reused. Continue?`)) return;
    launch(run);
  };

  // Deep links from the schedule: /mock?start=mock-1 or /mock?generate=cst
  const g = params.get("generate");
  const startId = params.get("start");
  const notice = g === "cst" || g === "tue"
    ? `Ready to generate a new ${g === "cst" ? "TU Delft CST" : "TU/e"} mock — use the button below.`
    : startId
      ? `Ready to start ${WRITTEN_MOCKS.find((m) => m.id === startId)?.title ?? startId} — choose the format below.`
      : null;

  if (!hydrated) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mock exams"
        subtitle="Full mocks with a timer per section. Once a section is submitted you cannot return to it. Results show scores by part and unit, a readiness indicator and your trend."
      />
      {activeRun && (
        <Card className="border-warn/40">
          <p className="text-sm">
            <strong>{activeRun.title}</strong> is in progress. <Link className="underline" href="/run">Resume it</Link> before starting another.
          </p>
        </Card>
      )}
      {notice && !activeRun && <p className="rounded-md bg-accent-soft px-4 py-2 text-sm">{notice}</p>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {BLUEPRINTS.map((bp) => (
          <Card key={bp.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <ExamBadge exam={bp.id === "cst" ? "delft" : "tue"} />
              <h2 className="font-semibold">{bp.title}</h2>
              {bp.estimated && <Badge tone="warn">counts ESTIMATED</Badge>}
            </div>
            <ul className="text-sm text-muted">
              {bp.sections.map((s) => (
                <li key={s.part}>
                  • {s.title}: {s.count} questions, {s.minutes} min{bp.weights[s.part] !== undefined && ` — ${bp.weights[s.part]}%`}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{bp.note}</p>
            <Button disabled={Boolean(activeRun)} onClick={() => generate(bp.id)}>
              Generate a new {bp.id === "cst" ? "CST" : "TU/e"} mock (unseen questions)
            </Button>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Fully written mocks</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {WRITTEN_MOCKS.map((m) => (
            <Card key={m.id} className="space-y-3">
              <h3 className="font-semibold">{m.title}</h3>
              <p className="text-sm text-muted">{m.description}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={Boolean(activeRun)} onClick={() => launch(createWrittenMock(m.id, "cst"))}>
                  Take in CST format (2 sections)
                </Button>
                <Button variant="secondary" disabled={Boolean(activeRun)} onClick={() => launch(createWrittenMock(m.id, "tue"))}>
                  Take in TU/e format (3 sections)
                </Button>
              </div>
            </Card>
          ))}
          {GENERATED_MOCKS.map((g) => (
            <Card key={g.id} className="space-y-3">
              <h3 className="font-semibold">{g.title}</h3>
              <p className="text-sm text-muted">Generated with `npm run mocks:generate` on {g.createdAt.slice(0, 10)}.</p>
              <Button
                disabled={Boolean(activeRun)}
                onClick={() =>
                  launch({
                    id: `${g.id}-${uid()}`,
                    kind: "mock",
                    title: g.title,
                    format: g.blueprint,
                    source: g.id,
                    noGoingBack: true,
                    startedAt: Date.now(),
                    sections: g.sections.map((s) => ({ part: s.part, title: s.title, minutes: s.minutes, items: s.qids.map((qid) => ({ qid, response: null, ms: 0, flagged: false, visited: false })), startedAt: null, deadline: null, finishedAt: null })),
                    sectionIndex: 0,
                    current: 0,
                    enteredAt: null,
                    onBreak: false,
                  })
                }
              >
                Start
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">History & readiness</h2>
        {mocks.length === 0 ? (
          <EmptyState title="No mocks taken yet">Your first full mock is scheduled for the week of 18 January.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(["cst", "tue"] as const).map((f) => {
              const list = mocks.filter((m) => m.format === f);
              const r = readiness(list.map((m) => m.score));
              return (
                <Card key={f} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ExamBadge exam={f === "cst" ? "delft" : "tue"} />
                    <span className="text-sm text-muted">{list.length} mock(s)</span>
                    {r && <Badge tone={r.tone === "bad" ? "bad" : r.tone === "warn" ? "warn" : r.tone === "good" ? "good" : "info"}>{r.label}</Badge>}
                  </div>
                  <Trend points={list.map((m) => m.score)} />
                  {r && <p className="text-xs text-muted">{r.explain} (Heuristic — dashed lines at 50/65/80%.)</p>}
                  <ul className="divide-y divide-line text-sm">
                    {[...list].reverse().map((m) => (
                      <li key={m.id} className="flex justify-between py-2">
                        <Link className="hover:underline" href={`/results/${encodeURIComponent(m.id)}`}>
                          {formatDate(m.finishedAt)} · {m.title}
                        </Link>
                        <span className="tabular font-medium">{m.score}%</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
