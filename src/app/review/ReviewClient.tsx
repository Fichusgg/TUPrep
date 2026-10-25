"use client";

import { useMemo, useState } from "react";
import { getQuestion } from "@/content";
import type { Question } from "@/content/schema";
import { ErrorList } from "@/components/ErrorList";
import { PracticeSession } from "@/components/PracticeSession";
import { Button, Card, PageHeader, Stat } from "@/components/ui";
import { createRng, randomSeed } from "@/lib/rng";
import { ERROR_TYPES, REVIEW_INTERVAL_DAYS, isDue } from "@/lib/srs";
import { useAppState, useHydrated } from "@/lib/store";

export function ReviewClient() {
  const hydrated = useHydrated();
  const { errors } = useAppState();
  const [now] = useState(() => Date.now());
  const [session, setSession] = useState<Question[] | null>(null);
  const open = useMemo(() => Object.values(errors).filter((e) => !e.resolved), [errors]);
  const due = open.filter((e) => isDue(e, now));

  if (!hydrated) return null;
  if (session) return <PracticeSession questions={session} mode="review" title="Spaced review" onExit={() => setSession(null)} />;

  const start = (ids: string[]) => {
    const qs = createRng(randomSeed())
      .shuffle(ids)
      .slice(0, 25)
      .map((id) => getQuestion(id))
      .filter((q): q is Question => Boolean(q));
    if (qs.length) setSession(qs);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        subtitle={`Every missed question enters your error log automatically. The review queue brings it back after ${REVIEW_INTERVAL_DAYS.join(", ")} days; answer it right at each step and it is resolved, miss it and it starts over.`}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex flex-col justify-between gap-4">
          <Stat label="Due now" value={due.length} hint={`${open.length} open in the error log`} />
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={() => start(due.map((e) => e.qid))} disabled={!due.length}>
              {due.length ? `Review ${Math.min(due.length, 25)} due` : "Nothing due"}
            </Button>
            <Button variant="secondary" onClick={() => start(open.map((e) => e.qid))} disabled={!open.length}>
              Review ahead (any open entry)
            </Button>
          </div>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="text-sm font-semibold">Why you miss questions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[...ERROR_TYPES.map((t) => ({ id: t.id as string, label: t.label })), { id: "", label: "Untagged" }].map((t) => {
              const n = open.filter((e) => (e.errorType ?? "") === t.id).length;
              return <Stat key={t.label} label={t.label} value={n} />;
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Tag each entry after reviewing it. Many “misread” or “careless” tags mean you should slow down; “time” means drill exam pace; “concept” means back to the unit overview and resources.</p>
        </Card>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Error log</h2>
        <ErrorList now={now} />
      </section>
    </div>
  );
}
