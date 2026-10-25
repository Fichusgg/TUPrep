"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { PART_BY_ID, UNIT_BY_ID } from "@/content";
import type { Question } from "@/content/schema";
import { formatAnswer, isCorrect, type Response } from "@/lib/grading";
import { createRng, hashString } from "@/lib/rng";
import { CodeBlock, Inline, RichText } from "./RichText";
import { DifficultyDots, PartBadge } from "./ui";

const LETTERS = "ABCDEFGH";

/** The order in which an ordering question's items are first shown (deterministic, never already solved). */
export function initialOrder(q: Question): number[] {
  if (q.type !== "order") return [];
  const rng = createRng(hashString(q.id));
  const base = q.options.map((_, i) => i);
  for (let k = 0; k < 10; k++) {
    const o = rng.shuffle(base);
    if (o.some((x, i) => x !== q.answer[i])) return o;
  }
  return [...base].reverse();
}

export function QuestionMeta({ q, index, total, showUnit = true }: { q: Question; index?: number; total?: number; showUnit?: boolean }) {
  const unit = UNIT_BY_ID[q.unit];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {index !== undefined && total !== undefined && (
        <span className="tabular font-medium text-fg">
          Question {index + 1} / {total}
        </span>
      )}
      {showUnit && unit && <PartBadge part={unit.part}>{unit.id}</PartBadge>}
      <span>{q.tags.slice(0, 2).join(" · ")}</span>
      <DifficultyDots level={q.difficulty} />
      <span className="tabular" title="Estimated time">
        ~{q.estSeconds}s
      </span>
    </div>
  );
}

export function QuestionView({
  q,
  response,
  onChange,
  revealed = false,
  onSubmit,
}: {
  q: Question;
  response: Response;
  onChange: (r: Response) => void;
  revealed?: boolean;
  onSubmit?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const startOrder = useMemo(() => initialOrder(q), [q]);
  useEffect(() => {
    if (q.type === "short" && !revealed) inputRef.current?.focus();
  }, [q.id, q.type, revealed]);

  return (
    <div className="space-y-4">
      <RichText text={q.prompt} className="text-base md:text-lg" />
      {q.code && <CodeBlock code={q.code} />}

      {q.type === "mc" && (
        <div role="radiogroup" aria-label="Answer options" className="grid grid-cols-1 gap-2">
          {q.options.map((c, i) => {
            const selected = response === i;
            let tone = "border-line bg-surface hover:bg-surface-2";
            if (selected && !revealed) tone = "border-accent bg-accent-soft";
            if (revealed && i === q.answer) tone = "border-good bg-good-soft";
            else if (revealed && selected) tone = "border-bad bg-bad-soft";
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={revealed}
                onClick={() => onChange(i)}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${tone} disabled:cursor-default`}
              >
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs font-semibold ${selected ? "border-accent bg-accent text-white dark:text-bg" : "border-line text-muted"}`}>
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 break-words">
                  <Inline text={c} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === "multi" && (
        <fieldset className="grid grid-cols-1 gap-2">
          <legend className="mb-1 text-xs text-muted">Select all that apply.</legend>
          {q.options.map((c, i) => {
            const chosen = Array.isArray(response) && response.includes(i);
            const isAns = q.answer.includes(i);
            let tone = "border-line bg-surface hover:bg-surface-2";
            if (chosen && !revealed) tone = "border-accent bg-accent-soft";
            if (revealed && isAns) tone = "border-good bg-good-soft";
            else if (revealed && chosen) tone = "border-bad bg-bad-soft";
            return (
              <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${tone}`}>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={chosen}
                  disabled={revealed}
                  onChange={() => {
                    const cur = Array.isArray(response) ? response : [];
                    onChange(chosen ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b));
                  }}
                />
                <span className="min-w-0 break-words">
                  <Inline text={c} />
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {q.type === "order" && (
        <OrderInput q={q} order={Array.isArray(response) && response.length === q.options.length ? response : startOrder} revealed={revealed} onChange={onChange} />
      )}

      {q.type === "short" && (
        <div className="space-y-1">
          <div className="flex max-w-md items-center gap-2">
            <label htmlFor={`ans-${q.id}`} className="sr-only">
              Your answer
            </label>
            <input
              id={`ans-${q.id}`}
              ref={inputRef}
              type="text"
              inputMode={q.answer.kind === "numeric" ? "decimal" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={q.placeholder ?? (q.answer.kind === "numeric" ? "e.g. 3/4 or −2" : "Your answer")}
              disabled={revealed}
              value={typeof response === "string" ? response : ""}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit?.();
                }
              }}
              className={`tabular w-full rounded-lg border bg-surface px-4 py-2.5 text-lg outline-none focus:border-accent ${revealed ? (isCorrect(q, response) ? "border-good" : "border-bad") : "border-line"}`}
            />
            {q.unitLabel && <span className="text-muted">{q.unitLabel}</span>}
          </div>
          {!revealed && q.answer.kind === "numeric" && (
            <p className="text-xs text-muted">Give an exact value: integers, decimals or fractions such as 7/2. No rounding.</p>
          )}
        </div>
      )}
    </div>
  );
}

function OrderInput({ q, order, revealed, onChange }: { q: Extract<Question, { type: "order" }>; order: number[]; revealed: boolean; onChange: (r: Response) => void }) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  return (
    <ol className="grid grid-cols-1 gap-2" aria-label="Put the items in order">
      {order.map((opt, pos) => {
        const right = revealed && q.answer[pos] === opt;
        return (
          <li key={opt} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${revealed ? (right ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : "border-line bg-surface"}`}>
            <span className="tabular w-6 text-center text-sm font-semibold text-muted">{pos + 1}</span>
            <span className="min-w-0 flex-1 break-words">
              <Inline text={q.options[opt]} />
            </span>
            {!revealed && (
              <span className="flex gap-1">
                <button type="button" className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-40" onClick={() => move(pos, pos - 1)} disabled={pos === 0} aria-label={`Move ${q.options[opt]} up`}>
                  ↑
                </button>
                <button type="button" className="rounded border border-line px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-40" onClick={() => move(pos, pos + 1)} disabled={pos === order.length - 1} aria-label={`Move ${q.options[opt]} down`}>
                  ↓
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Feedback({ q, response }: { q: Question; response: Response }) {
  const correct = isCorrect(q, response);
  const unit = UNIT_BY_ID[q.unit];
  return (
    <div role="status" className={`rounded-lg border p-4 ${correct ? "border-good/40 bg-good-soft" : "border-bad/40 bg-bad-soft"}`}>
      <p className={`font-semibold ${correct ? "text-good" : "text-bad"}`}>
        {correct ? "Correct" : "Not quite"}
        {!correct && (
          <span className="font-normal text-fg">
            {" "}
            — the answer is <Inline text={formatAnswer(q)} />
          </span>
        )}
      </p>
      <div className="mt-2 text-sm">
        <span className="font-medium">Worked solution. </span>
        <RichText text={q.explanation} className="inline" />
      </div>
      {unit && (
        <p className="mt-3 text-xs text-muted">
          Unit:{" "}
          <Link className="underline underline-offset-2 hover:text-fg" href={`/units/${unit.id}`}>
            {unit.id} {unit.title}
          </Link>{" "}
          · {PART_BY_ID[unit.part].short}
        </p>
      )}
    </div>
  );
}
