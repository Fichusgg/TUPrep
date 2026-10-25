"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RESOURCE_BY_ID, UNIT_BY_ID } from "@/content";
import type { Question } from "@/content/schema";
import { formatDuration } from "@/lib/format";
import { formatAnswer, formatResponse, isAnswered, isCorrect, type Response } from "@/lib/grading";
import { addToErrorLog, recordAnswers, toggleBookmark, useAppState, type AttemptMode } from "@/lib/store";
import { Feedback, initialOrder, QuestionMeta, QuestionView } from "./QuestionView";
import { CodeBlock, Inline, RichText } from "./RichText";
import { IconBulb } from "./Icons";
import { Button, Card } from "./ui";

interface Result {
  q: Question;
  response: Response;
  correct: boolean;
  ms: number;
  hint: boolean;
}

/**
 * Question-by-question session with instant feedback, a one-step hint, worked solutions,
 * bookmarks and "add to error log". Misses are added to the error log automatically.
 */
export function PracticeSession({
  questions,
  mode,
  title,
  paceSeconds,
  onExit,
  onRestart,
}: {
  questions: Question[];
  mode: Exclude<AttemptMode, "test" | "mock">;
  title?: string;
  /** Optional per-question time target (seconds); shows a soft countdown, never blocks. */
  paceSeconds?: number;
  onExit: () => void;
  onRestart?: () => void;
}) {
  const { bookmarks, errors } = useAppState();
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<Response>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const q = questions[index];
  const done = index >= questions.length;

  useEffect(() => {
    if (!paceSeconds || revealed || done) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [paceSeconds, revealed, done]);

  const effective = useCallback((r: Response): Response => (q?.type === "order" && r === null ? initialOrder(q) : r), [q]);

  const submit = useCallback(() => {
    if (!q || revealed) return;
    const r = effective(response);
    const ms = Date.now() - startedAt;
    const correct = isCorrect(q, r);
    recordAnswers([{ q, correct, ms, mode, hint }]);
    setResponse(r);
    setResults((x) => [...x, { q, response: r, correct, ms, hint }]);
    setRevealed(true);
  }, [q, response, revealed, mode, hint, effective, startedAt]);

  const next = useCallback(() => {
    setRevealed(false);
    setResponse(null);
    setHint(false);
    const t = Date.now();
    setStartedAt(t);
    setNow(t);
    setIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
      if (e.key === "Enter" && !typing) {
        e.preventDefault();
        if (revealed) next();
        else if (isAnswered(response) || q.type === "order") submit();
        return;
      }
      if (q.type === "mc" && !revealed && !typing) {
        const n = "12345678".indexOf(e.key);
        const l = "abcdefgh".indexOf(e.key.toLowerCase());
        const i = n >= 0 ? n : l;
        if (i >= 0 && i < q.options.length) setResponse(i);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, revealed, response, next, submit]);

  const summary = useMemo(() => {
    const correct = results.filter((r) => r.correct).length;
    return { correct, total: results.length, ms: results.reduce((s, r) => s + r.ms, 0) };
  }, [results]);

  if (done || !q) {
    const pctScore = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="p-6 text-center md:p-8">
          <p className="text-sm font-medium text-muted">{title ?? "Session"} complete</p>
          <div className={`tabular mt-2 text-5xl font-semibold ${pctScore >= 70 ? "text-good" : ""}`}>{pctScore}%</div>
          <p className="mt-2 text-muted">
            {summary.correct} of {summary.total} correct · {summary.total ? formatDuration(summary.ms / summary.total) : "0:00"} per question
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <Segments results={results} total={results.length} index={results.length} />
          </div>
          {summary.correct < summary.total && <p className="mt-4 text-sm text-muted">Your mistakes are saved and will come back in the review queue tomorrow.</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {onRestart && <Button onClick={onRestart}>Practise again</Button>}
            <Button variant="secondary" onClick={onExit}>
              Done
            </Button>
          </div>
        </Card>
        {results.some((r) => !r.correct) && <h2 className="font-semibold">Look again at what you missed</h2>}
        <div className="space-y-3">
          {[...results.filter((r) => !r.correct), ...results.filter((r) => r.correct)].map((r, i) => (
            <details key={r.q.id + i} className="rounded-xl border border-line bg-surface p-4">
              <summary className="flex cursor-pointer items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.correct ? "bg-good" : "bg-bad"}`} aria-hidden />
                <span className="sr-only">{r.correct ? "Correct" : "Incorrect"}:</span>
                <span className="line-clamp-1 flex-1 text-sm">
                  <Inline text={r.q.prompt.split("\n")[0]} />
                </span>
                <span className="tabular text-xs text-muted">{formatDuration(r.ms)}</span>
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <RichText text={r.q.prompt} />
                {r.q.code && <CodeBlock code={r.q.code} />}
                <p>
                  Your answer: <strong><Inline text={formatResponse(r.q, r.response)} /></strong> · Correct: <strong><Inline text={formatAnswer(r.q)} /></strong>
                  {r.hint && <span className="text-muted"> · hint used</span>}
                </p>
                <RichText text={r.q.explanation} className="text-muted" />
              </div>
            </details>
          ))}
        </div>
      </div>
    );
  }

  const elapsed = Math.max(0, now - startedAt) / 1000;
  const over = paceSeconds !== undefined && elapsed > paceSeconds;
  const bookmarked = bookmarks.includes(q.id);
  const inLog = Boolean(errors[q.id] && !errors[q.id].resolved);
  const unit = UNIT_BY_ID[q.unit];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => (results.length ? setIndex(questions.length) : onExit())} className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          ✕ <span className="hidden sm:inline">End session</span>
        </button>
        <div className="flex-1">
          <Segments results={results} total={questions.length} index={index} />
        </div>
        <span className="tabular shrink-0 text-sm text-muted">
          {index + 1}/{questions.length}
        </span>
      </div>
      {title && <p className="text-sm text-muted">{title}</p>}
      <Card className="space-y-5 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <QuestionMeta q={q} />
          <div className="flex items-center gap-1">
            {paceSeconds && !revealed && (
              <span className={`tabular rounded-md px-2 py-0.5 text-xs ${over ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted"}`}>
                {over ? "+" : ""}
                {formatDuration(Math.abs(paceSeconds - elapsed) * 1000)}
              </span>
            )}
            <button type="button" onClick={() => toggleBookmark(q.id)} aria-pressed={bookmarked} className={`rounded-md px-2 py-1 text-xs ${bookmarked ? "bg-warn/20 text-warn" : "text-muted hover:text-fg"}`}>
              {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </button>
          </div>
        </div>
        <QuestionView key={q.id} q={q} response={response} onChange={setResponse} revealed={revealed} onSubmit={submit} />
        {!revealed && hint && (
          <div role="note" className="flex gap-2 rounded-xl border border-accent/30 bg-accent-soft p-4 text-sm">
            <IconBulb className="h-5 w-5 shrink-0 text-accent" />
            <span>
              <span className="font-medium">Hint: </span>
              <Inline text={q.hint} />
            </span>
          </div>
        )}
        {revealed && <Feedback q={q} response={response} />}
        {revealed && unit && unit.resources.length > 0 && (
          <p className="text-xs text-muted">
            Go deeper:{" "}
            {unit.resources.slice(0, 3).map((rid, i) => (
              <span key={rid}>
                {i > 0 && " · "}
                <Link href={`/resources#${rid}`} className="underline underline-offset-2 hover:text-fg">
                  {RESOURCE_BY_ID[rid]?.title ?? rid}
                </Link>
              </span>
            ))}
          </p>
        )}
      </Card>
      {/* Action bar: sticky above the phone tab bar, inline on larger screens */}
      <div className="sticky bottom-16 z-30 -mx-4 flex items-center gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {!revealed && !hint && (
          <Button variant="secondary" onClick={() => setHint(true)}>
            Show hint
          </Button>
        )}
        {revealed && (
          <Button variant="ghost" onClick={() => addToErrorLog(q)} disabled={inLog}>
            {inLog ? "Saved for review" : "Save for review"}
          </Button>
        )}
        <div className="ml-auto">
          {revealed ? (
            <Button onClick={next} autoFocus className="min-h-11 px-6">
              {index + 1 < questions.length ? "Next question" : "See summary"}
            </Button>
          ) : (
            <Button onClick={submit} disabled={!isAnswered(response) && q.type !== "order"} className="min-h-11 px-6">
              Check answer
            </Button>
          )}
        </div>
      </div>
      <p className="hidden text-center text-xs text-muted md:block">Keyboard: 1–6 or A–F to choose · Enter to check / continue</p>
    </div>
  );
}

/** One segment per question: green = right, orange = wrong, accent = current. */
function Segments({ results, total, index }: { results: Result[]; total: number; index: number }) {
  return (
    <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={results.length} aria-label="Session progress">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const cls = r ? (r.correct ? "bg-good" : "bg-bad") : i === index ? "bg-accent" : "bg-surface-2";
        return <span key={i} className={`h-2 flex-1 rounded-full ${cls}`} />;
      })}
    </div>
  );
}
