"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getQuestion, PART_BY_ID } from "@/content";
import { formatDuration } from "@/lib/format";
import { isAnswered, type Response } from "@/lib/grading";
import { finishRun } from "@/lib/runs";
import { getState, setActiveRun, updateActiveRun, type ActiveRun } from "@/lib/store";
import { initialOrder, QuestionMeta, QuestionView } from "./QuestionView";
import { Button, Card } from "./ui";

function useNow(ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Add the time spent on the current question to its item, then apply `then` to the run. */
function leaveCurrent(r: ActiveRun, now: number): ActiveRun {
  if (r.enteredAt === null) return r;
  return {
    ...r,
    enteredAt: null,
    sections: r.sections.map((s, si) =>
      si === r.sectionIndex ? { ...s, items: s.items.map((it, qi) => (qi === r.current ? { ...it, ms: it.ms + Math.max(0, Math.min(now, s.deadline ?? now) - r.enteredAt!) } : it)) } : s,
    ),
  };
}

export function RunPlayer({ run }: { run: ActiveRun }) {
  const router = useRouter();
  const section = run.sections[run.sectionIndex];

  const finishSection = useCallback(() => {
    const cur = getState().activeRun;
    if (!cur) return;
    const now = Date.now();
    const s = leaveCurrent(cur, now);
    const closed: ActiveRun = { ...s, sections: s.sections.map((x, i) => (i === s.sectionIndex ? { ...x, finishedAt: Math.min(now, x.deadline ?? now) } : x)) };
    if (closed.sectionIndex + 1 >= closed.sections.length) {
      const result = finishRun(closed, now);
      router.push(`/results/${encodeURIComponent(result.id)}`);
    } else {
      setActiveRun({ ...closed, sectionIndex: closed.sectionIndex + 1, current: 0, onBreak: true });
    }
  }, [router]);

  const abandon = () => {
    if (window.confirm("Abandon this test? Nothing will be saved.")) setActiveRun(null);
  };

  if (run.onBreak) {
    const prev = run.sections[run.sectionIndex - 1];
    return (
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-sm text-muted">{run.title}</p>
        <h1 className="mt-1 text-2xl font-semibold">Section submitted</h1>
        <p className="mt-2 text-muted">
          {prev.title}: {prev.items.filter((i) => isAnswered(i.response)).length} of {prev.items.length} answered. This section is now locked. The next timer starts only when you continue.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => updateActiveRun((r) => ({ ...r, onBreak: false }))}>Continue</Button>
          <Button variant="ghost" onClick={abandon}>
            Abandon
          </Button>
        </div>
      </Card>
    );
  }

  if (section.startedAt === null) {
    return (
      <Card className="mx-auto max-w-xl">
        <p className="text-sm text-muted">
          {run.title} · Section {run.sectionIndex + 1} of {run.sections.length}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{section.title}</h1>
        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          <li>
            • <strong className="text-fg">{section.items.length} questions</strong> in <strong className="text-fg">{section.minutes} minutes</strong> (≈ {Math.round((section.minutes * 60) / section.items.length)} s each).
          </li>
          <li>• The timer cannot be paused, keeps running if you reload or close the page, and submits automatically at zero.</li>
          {run.noGoingBack ? (
            <li>
              • <strong className="text-fg">No going back:</strong> once you move to the next question you cannot return.
            </li>
          ) : (
            <li>• You can move freely between the questions of this section and mark them for review.</li>
          )}
          {run.sections.length > 1 && <li>• Once a section is submitted you cannot return to it.</li>}
          <li>• No calculator. Scrap paper is fine. No feedback until the end.</li>
        </ul>
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => {
              const now = Date.now();
              updateActiveRun((r) => ({
                ...r,
                enteredAt: now,
                sections: r.sections.map((x, i) => (i === r.sectionIndex ? { ...x, startedAt: now, deadline: now + x.minutes * 60_000, items: x.items.map((it, k) => (k === 0 ? { ...it, visited: true } : it)) } : x)),
              }));
            }}
          >
            Start section
          </Button>
          <Button variant="ghost" onClick={abandon}>
            Abandon
          </Button>
        </div>
      </Card>
    );
  }

  return <SectionView run={run} onFinishSection={finishSection} />;
}

function SectionView({ run, onFinishSection }: { run: ActiveRun; onFinishSection: () => void }) {
  const now = useNow();
  const section = run.sections[run.sectionIndex];
  const questions = useMemo(() => section.items.map((it) => getQuestion(it.qid)), [section.items]);
  const i = run.current;
  const q = questions[i];
  const item = section.items[i];
  const remaining = (section.deadline ?? now) - now;
  const answered = section.items.filter((it) => isAnswered(it.response)).length;

  useEffect(() => {
    if (remaining <= 0) onFinishSection();
  }, [remaining, onFinishSection]);

  // Ordering questions start in their displayed order, so "no change" is a real answer.
  useEffect(() => {
    if (q?.type === "order" && item.response === null) setResponse(initialOrder(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  function setResponse(r: Response) {
    updateActiveRun((x) => ({
      ...x,
      sections: x.sections.map((s, si) => (si === x.sectionIndex ? { ...s, items: s.items.map((it, qi) => (qi === x.current ? { ...it, response: r } : it)) } : s)),
    }));
  }

  const goTo = (n: number) => {
    if (n < 0 || n >= section.items.length) return;
    if (run.noGoingBack && n < i) return;
    const t = Date.now();
    updateActiveRun((x) => {
      const left = leaveCurrent(x, t);
      return {
        ...left,
        current: n,
        enteredAt: t,
        sections: left.sections.map((s, si) => (si === left.sectionIndex ? { ...s, items: s.items.map((it, qi) => (qi === n ? { ...it, visited: true } : it)) } : s)),
      };
    });
  };

  const toggleFlag = () =>
    updateActiveRun((x) => ({
      ...x,
      sections: x.sections.map((s, si) => (si === x.sectionIndex ? { ...s, items: s.items.map((it, qi) => (qi === x.current ? { ...it, flagged: !it.flagged } : it)) } : s)),
    }));

  const confirmFinish = () => {
    const open = section.items.length - answered;
    if (window.confirm(open > 0 ? `${open} question(s) unanswered. Submit this section anyway? You cannot come back.` : "Submit this section? You cannot come back.")) onFinishSection();
  };

  const last = i + 1 >= section.items.length;
  const low = remaining < 60_000;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <span className="font-medium">{section.title}</span>
        <span className="text-sm text-muted">
          {PART_BY_ID[section.part].short} · {answered}/{section.items.length} answered
          {run.sections.length > 1 && ` · section ${run.sectionIndex + 1}/${run.sections.length}`}
        </span>
        <span role="timer" aria-label="Time remaining" className={`tabular ml-auto rounded-md px-3 py-1 font-mono text-lg ${low ? "bg-bad-soft text-bad" : "bg-surface-2"}`}>
          {formatDuration(remaining)}
        </span>
        <Button variant="secondary" onClick={confirmFinish}>
          Submit section
        </Button>
      </div>

      <div className={`grid gap-4 ${run.noGoingBack ? "" : "lg:grid-cols-[1fr_220px]"}`}>
        <Card className="space-y-5">
          {q ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <QuestionMeta q={q} index={i} total={questions.length} showUnit={run.kind === "mock"} />
                {!run.noGoingBack && (
                  <button type="button" onClick={toggleFlag} aria-pressed={item.flagged} className={`rounded-md px-2 py-0.5 text-xs ${item.flagged ? "bg-warn/20 text-warn" : "text-muted hover:text-fg"}`}>
                    {item.flagged ? "★ Marked" : "☆ Mark for review"}
                  </button>
                )}
              </div>
              <QuestionView key={q.id} q={q} response={item.response} onChange={setResponse} onSubmit={() => (!last ? goTo(i + 1) : undefined)} />
            </>
          ) : (
            <p className="text-bad">This question could not be loaded.</p>
          )}
          <div className="flex justify-between gap-2 border-t border-line pt-4">
            {run.noGoingBack ? (
              <span className="self-center text-xs text-muted">No going back in this test.</span>
            ) : (
              <Button variant="secondary" onClick={() => goTo(i - 1)} disabled={i === 0}>
                ← Previous
              </Button>
            )}
            {!last ? <Button onClick={() => goTo(i + 1)}>Next →</Button> : <Button onClick={confirmFinish}>Submit section</Button>}
          </div>
        </Card>

        {!run.noGoingBack && (
          <Card className="h-fit">
            <h2 className="text-sm font-medium">Questions</h2>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {section.items.map((it, n) => {
                const done = isAnswered(it.response);
                return (
                  <button
                    key={it.qid}
                    type="button"
                    onClick={() => goTo(n)}
                    aria-label={`Question ${n + 1}${done ? ", answered" : ""}${it.flagged ? ", marked" : ""}`}
                    aria-current={n === i ? "step" : undefined}
                    className={`tabular relative h-9 rounded-md border text-xs font-medium ${n === i ? "border-accent ring-2 ring-accent/30" : "border-line"} ${done ? "bg-accent text-white dark:text-bg" : "bg-surface"}`}
                  >
                    {n + 1}
                    {it.flagged && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
