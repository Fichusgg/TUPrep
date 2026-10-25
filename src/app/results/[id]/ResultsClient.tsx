"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getQuestion, PART_BY_ID, RESOURCE_BY_ID, UNIT_BY_ID } from "@/content";
import { CodeBlock, Inline, RichText } from "@/components/RichText";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, PartBadge, ProgressBar } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";
import { formatAnswer, formatResponse, isCorrect } from "@/lib/grading";
import { pct, readiness } from "@/lib/scoring";
import { deleteRunResult, useAppState, useHydrated } from "@/lib/store";

export function ResultsClient({ id }: { id: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const { runs } = useAppState();
  const result = runs.find((r) => r.id === id);
  const [filter, setFilter] = useState<"wrong" | "all" | "flagged">("wrong");

  const byUnit = useMemo(() => {
    if (!result) return [];
    const m = new Map<string, { correct: number; total: number }>();
    for (const s of result.sections)
      for (const it of s.items) {
        const q = getQuestion(it.qid);
        if (!q) continue;
        const t = m.get(q.unit) ?? { correct: 0, total: 0 };
        t.total++;
        if (isCorrect(q, it.response)) t.correct++;
        m.set(q.unit, t);
      }
    return [...m].map(([unit, v]) => ({ unit, ...v })).sort((a, b) => a.correct / a.total - b.correct / b.total);
  }, [result]);

  if (!hydrated) return null;
  if (!result) return <EmptyState title="Result not found">It may have been deleted, or it was taken in another browser.</EmptyState>;

  const sameFormat = runs.filter((r) => r.kind === "mock" && r.format === result.format);
  const ready = result.kind === "mock" ? readiness(sameFormat.filter((r) => r.finishedAt <= result.finishedAt).map((r) => r.score)) : null;
  const all = result.sections.flatMap((s, si) => s.items.map((it, qi) => ({ ...it, si, qi, n: qi + 1 })));
  const shown = all.filter((x) => {
    const q = getQuestion(x.qid);
    if (!q) return false;
    return filter === "all" ? true : filter === "flagged" ? x.flagged : !isCorrect(q, x.response);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={result.title}
        subtitle={`${result.kind === "mock" ? "Mock exam" : "Unit timed test"} · ${formatDate(result.finishedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}${result.noGoingBack ? " · no going back" : ""}`}
        actions={
          <>
            {result.unit ? <ButtonLink href={`/units/${result.unit}?tab=test`}>Another test</ButtonLink> : <ButtonLink href="/mock">Mocks</ButtonLink>}
            <ButtonLink href="/review" variant="secondary">
              Review queue
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{result.kind === "mock" ? `${result.format === "tue" ? "TU/e" : "CST"} weighted score` : "Score"}</div>
          <div className="tabular mt-1 text-4xl font-semibold">{result.score}%</div>
          {ready && (
            <div className="mt-3">
              <Badge tone={ready.tone === "bad" ? "bad" : ready.tone === "warn" ? "warn" : ready.tone === "good" ? "good" : "info"}>Readiness: {ready.label}</Badge>
              <p className="mt-1 text-xs text-muted">{ready.explain} Heuristic only — no official pass marks exist.</p>
            </div>
          )}
        </Card>
        <Card className="space-y-4 md:col-span-3">
          {result.sections.map((s) => {
            const p = pct(s.correct, s.total);
            const used = s.items.reduce((a, it) => a + it.ms, 0);
            return (
              <div key={s.title}>
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">{s.title}</span>
                  <span className="tabular text-muted">
                    {s.correct}/{s.total} · {p}% · {formatDuration(used)} of {s.minutes}:00
                  </span>
                </div>
                <ProgressBar value={p} tone={p >= 70 ? "good" : p < 45 ? "bad" : "accent"} label={`${s.title} score`} />
              </div>
            );
          })}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">By unit</h2>
        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {byUnit.map((u) => (
            <div key={u.unit} className="flex items-center justify-between gap-3 text-sm">
              <Link href={`/units/${u.unit}`} className="hover:underline">
                {u.unit} {UNIT_BY_ID[u.unit]?.title}
              </Link>
              <span className="tabular text-muted">
                {u.correct}/{u.total}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Every missed question is now in your error log (review queue: after 1, 3, 7 and 21 days).</p>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Answer review</h2>
          <div className="flex gap-1 rounded-lg border border-line p-1 text-sm" role="group" aria-label="Filter answers">
            {(["wrong", "flagged", "all"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 ${filter === f ? "bg-surface-2 font-medium" : "text-muted"}`}>
                {f === "wrong" ? "Incorrect" : f === "flagged" ? "Marked" : "All"}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState title={filter === "wrong" ? "No incorrect answers — excellent." : "Nothing to show."} />
        ) : (
          <div className="space-y-3">
            {shown.map((x) => {
              const q = getQuestion(x.qid)!;
              const ok = isCorrect(q, x.response);
              const unit = UNIT_BY_ID[q.unit];
              return (
                <details key={x.qid} className="rounded-lg border border-line bg-surface p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-good" : "bg-bad"}`} aria-hidden />
                    <span className="tabular text-xs text-muted">
                      {result.sections.length > 1 ? `S${x.si + 1} ` : ""}#{x.n}
                    </span>
                    <PartBadge part={unit.part}>{unit.id}</PartBadge>
                    <span className="line-clamp-1 flex-1 text-sm">
                      <Inline text={q.prompt.split("\n")[0]} />
                    </span>
                    <span className="tabular text-xs text-muted" title="Time spent / estimated">
                      {formatDuration(x.ms)} / ~{q.estSeconds}s
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm">
                    <RichText text={q.prompt} />
                    {q.code && <CodeBlock code={q.code} />}
                    <p>
                      Your answer: <strong className={ok ? "text-good" : "text-bad"}><Inline text={formatResponse(q, x.response)} /></strong> · Correct: <strong><Inline text={formatAnswer(q)} /></strong>
                    </p>
                    <RichText text={q.explanation} className="text-muted" />
                    <p className="text-xs text-muted">
                      Study: <Link className="underline" href={`/units/${unit.id}`}>{unit.id} {unit.title}</Link>
                      {unit.resources.slice(0, 2).map((rid) => (
                        <span key={rid}>
                          {" · "}
                          <Link className="underline" href={`/resources#${rid}`}>
                            {RESOURCE_BY_ID[rid]?.title}
                          </Link>
                        </span>
                      ))}{" "}
                      · {PART_BY_ID[unit.part].short}
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-t border-line pt-4">
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm("Delete this result? Answers already counted in your statistics stay.")) {
              deleteRunResult(result.id);
              router.push(result.unit ? `/units/${result.unit}?tab=test` : "/mock");
            }
          }}
        >
          Delete this result
        </Button>
      </div>
    </div>
  );
}
