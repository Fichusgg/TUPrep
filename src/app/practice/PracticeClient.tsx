"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { BANK, getQuestion, PARTS } from "@/content";
import type { PartId, Question } from "@/content/schema";
import { PracticeSession } from "@/components/PracticeSession";
import { Button, Card, PageHeader } from "@/components/ui";
import { createRng, hashString, randomSeed } from "@/lib/rng";
import { weakestTags } from "@/lib/stats";
import { useAppState, useHydrated, type AttemptMode } from "@/lib/store";

interface Spec {
  title: string;
  mode: Exclude<AttemptMode, "test" | "mock">;
  questions: Question[];
  pace?: number;
}

/** Mixed sets across units: diagnostics, warm-ups, part-wide practice, weakest-tag drills and explicit id lists. */
export function PracticeClient() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const { attempts, bookmarks } = useAppState();
  const [spec, setSpec] = useState<Spec | null>(null);
  const seen = useMemo(() => new Set(attempts.map((a) => a.qid)), [attempts]);
  const weak = useMemo(() => weakestTags(attempts, 3, 5), [attempts]);

  const build = (opts: { part?: PartId; count: number; label?: string; mode?: string; ids?: string[]; timed?: boolean }, seed = randomSeed()): Spec => {
    const rng = createRng(seed);
    let pool: Question[] = BANK;
    let title = "Mixed practice";
    let mode: Spec["mode"] = "practice";
    if (opts.ids?.length) {
      pool = opts.ids.map((id) => getQuestion(id)).filter((q): q is Question => Boolean(q));
      title = "Selected questions";
    } else if (opts.mode === "weakest") {
      const tags = new Set(weak.map((w) => w.tag));
      pool = tags.size ? BANK.filter((q) => q.tags.some((t) => tags.has(t))) : BANK;
      title = tags.size ? `Weakest-topic drill: ${[...tags].slice(0, 3).join(", ")}` : "Weakest-topic drill (not enough data yet — mixed set)";
    } else if (opts.mode === "bookmarks") {
      pool = BANK.filter((q) => bookmarks.includes(q.id));
      title = "Bookmarked questions";
    }
    if (opts.part) pool = pool.filter((q) => q.unit.startsWith(opts.part === "logic" ? "L" : opts.part === "math" ? "M" : "A"));
    if (opts.label === "diagnostic") {
      mode = "diagnostic";
      title = `Diagnostic${opts.timed ? " (timed)" : " (untimed)"}: ${PARTS.find((p) => p.id === opts.part)?.title ?? "mixed"}`;
    } else if (opts.label === "warmup") title = "Warm-up";
    else if (opts.part && !opts.mode) title = `Mixed practice: ${PARTS.find((p) => p.id === opts.part)?.title}`;
    // Spread over units and difficulties: round-robin over units, unseen first.
    const byUnit = new Map<string, Question[]>();
    for (const q of rng.shuffle(pool)) byUnit.set(q.unit, [...(byUnit.get(q.unit) ?? []), q]);
    for (const [u, qs] of byUnit) byUnit.set(u, [...qs.filter((q) => !seen.has(q.id)), ...qs.filter((q) => seen.has(q.id))]);
    const out: Question[] = [];
    const queues = rng.shuffle([...byUnit.values()]);
    while (out.length < opts.count && queues.some((x) => x.length)) for (const qu of queues) if (qu.length && out.length < opts.count) out.push(qu.shift()!);
    return { title, mode, questions: opts.ids?.length ? pool : out, pace: opts.timed && opts.part ? scheduleConfig.pace[opts.part] : undefined };
  };

  // Deep links from the schedule (/practice?part=logic&count=12&timed=1 …): build the set once per URL.
  // Done during render with a guard (React's "adjust state on prop change" pattern), seeded by the URL.
  const urlKey = hydrated ? params.toString() : "";
  const [builtFor, setBuiltFor] = useState("");
  if (urlKey !== builtFor) {
    setBuiltFor(urlKey);
    const part = params.get("part") as PartId | null;
    const ids = params.get("ids")?.split(",").filter(Boolean);
    const mode = params.get("mode") ?? undefined;
    if (part || ids || mode) {
      setSpec(build({ part: part ?? undefined, count: Number(params.get("count") ?? 10), label: params.get("label") ?? undefined, mode, ids, timed: params.get("timed") === "1" }, hashString(urlKey)));
    }
  }

  if (spec)
    return (
      <PracticeSession
        key={spec.questions.map((q) => q.id).join()}
        questions={spec.questions}
        mode={spec.mode}
        title={spec.title}
        paceSeconds={spec.pace}
        onExit={() => {
          setSpec(null);
          router.replace("/practice");
        }}
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Practice" subtitle="Mixed sets across units. For practice inside one unit (by difficulty and tag, challenge mode, missed questions), open the unit page." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PARTS.map((p) => (
          <Card key={p.id} className="space-y-2">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="text-xs text-muted">{p.delft ? `TU Delft ${p.delft} · ` : ""}TU/e {p.tue}</p>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <Button onClick={() => setSpec(build({ part: p.id, count: 10 }))}>Mixed set · 10</Button>
              <Button variant="secondary" onClick={() => setSpec(build({ part: p.id, count: 12, timed: true }))}>
                Timed-pace set · 12
              </Button>
              <Button variant="secondary" onClick={() => setSpec(build({ part: p.id, count: 12, label: "diagnostic" }))}>
                Diagnostic · 12
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-semibold">Weakest-topic drill</h2>
          <p className="text-sm text-muted">{weak.length ? `Your weakest tags: ${weak.map((w) => `${w.tag} (${w.accuracy}%)`).join(", ")}.` : "Answer a few more questions (3+ per tag) to unlock this."}</p>
          <Button onClick={() => setSpec(build({ mode: "weakest", count: 12 }))} disabled={!weak.length}>
            Start drill · 12
          </Button>
        </Card>
        <Card className="space-y-2">
          <h2 className="font-semibold">Review & bookmarks</h2>
          <p className="text-sm text-muted">
            Spaced review of your mistakes lives in <Link className="underline" href="/review">Review</Link>.
          </p>
          <Button variant="secondary" onClick={() => setSpec(build({ mode: "bookmarks", count: 30 }))} disabled={!bookmarks.length}>
            Bookmarked questions ({bookmarks.length})
          </Button>
        </Card>
      </div>
    </div>
  );
}
