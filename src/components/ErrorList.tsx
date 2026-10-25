"use client";

import { useMemo, useState } from "react";
import { getQuestion, UNIT_BY_ID } from "@/content";
import { formatDate } from "@/lib/format";
import { formatAnswer } from "@/lib/grading";
import { ERROR_TYPES, type ErrorType } from "@/lib/srs";
import { removeError, setErrorType, updateError, useAppState } from "@/lib/store";
import { CodeBlock, Inline, RichText } from "./RichText";
import { Badge, EmptyState, PartBadge } from "./ui";

/** Error log with error-type tagging (concept / misread / time / careless) and notes. */
export function ErrorList({ unit, now }: { unit?: string; now: number }) {
  const { errors } = useAppState();
  const [showResolved, setShowResolved] = useState(false);
  const [type, setType] = useState<ErrorType | "untagged" | "all">("all");
  const list = useMemo(
    () =>
      Object.values(errors)
        .filter((e) => (!unit || e.unit === unit) && (showResolved || !e.resolved))
        .filter((e) => type === "all" || (type === "untagged" ? !e.errorType : e.errorType === type))
        .sort((a, b) => a.due - b.due),
    [errors, unit, showResolved, type],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Filter:</span>
        {(["all", "untagged", ...ERROR_TYPES.map((t) => t.id)] as const).map((t) => (
          <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`rounded-full border px-3 py-0.5 ${type === t ? "border-accent bg-accent-soft" : "border-line text-muted"}`}>
            {t === "all" ? "All" : t === "untagged" ? "Untagged" : ERROR_TYPES.find((x) => x.id === t)!.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-muted">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> show resolved
        </label>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No entries">Missed questions are added here automatically; you can also add any question with “Add to error log”.</EmptyState>
      ) : (
        list.map((e) => {
          const q = getQuestion(e.qid);
          if (!q) return null;
          const u = UNIT_BY_ID[e.unit];
          return (
            <details key={e.qid} className="rounded-lg border border-line bg-surface p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <PartBadge part={u.part}>{u.id}</PartBadge>
                <span className="tabular text-xs text-muted">{q.id}</span>
                <span className="line-clamp-1 min-w-0 flex-1 text-sm">
                  <Inline text={q.prompt.split("\n")[0]} />
                </span>
                {e.errorType ? <Badge tone="info">{ERROR_TYPES.find((t) => t.id === e.errorType)!.label}</Badge> : <Badge tone="warn">tag me</Badge>}
                <span className="tabular text-xs text-muted">
                  {e.resolved ? "resolved" : e.due <= now ? "due now" : `due ${formatDate(e.due, { day: "numeric", month: "short" })}`} · missed {e.misses}×
                </span>
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <RichText text={q.prompt} />
                {q.code && <CodeBlock code={q.code} />}
                <p>
                  Answer: <strong><Inline text={formatAnswer(q)} /></strong>
                </p>
                <RichText text={q.explanation} className="text-muted" />
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Error type">
                  <span className="text-xs text-muted">Why did you miss it?</span>
                  {ERROR_TYPES.map((t) => (
                    <button key={t.id} type="button" title={t.help} aria-pressed={e.errorType === t.id} onClick={() => setErrorType(e.qid, e.errorType === t.id ? undefined : t.id)} className={`rounded-full border px-3 py-0.5 text-xs ${e.errorType === t.id ? "border-accent bg-accent-soft" : "border-line text-muted hover:text-fg"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="text-xs text-muted">Note</span>
                  <textarea
                    defaultValue={e.note ?? ""}
                    onBlur={(ev) => updateError(e.qid, { note: ev.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="What will you do differently next time?"
                  />
                </label>
                <div className="flex gap-3 text-xs">
                  <span className="text-muted">
                    First missed {formatDate(e.firstMissed, { day: "numeric", month: "short" })} · stage {Math.min(e.stage + 1, 4)}/4 ({e.source === "manual" ? "added by you" : "auto"})
                  </span>
                  <button type="button" className="ml-auto text-muted hover:text-fg" onClick={() => updateError(e.qid, { resolved: !e.resolved })}>
                    {e.resolved ? "Reopen" : "Mark resolved"}
                  </button>
                  <button type="button" className="text-muted hover:text-bad" onClick={() => removeError(e.qid)}>
                    Remove
                  </button>
                </div>
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
