"use client";

import Link from "next/link";
import type { Resource } from "@/content/schema";
import { toggleResource, useAppState } from "@/lib/store";
import { Badge } from "./ui";

const STATUS: Record<Resource["status"], { label: string; tone: "good" | "info" | "warn" | "muted"; title: string }> = {
  verified: { label: "link checked", tone: "good", title: "On your list; link opened and checked on 24 Oct 2026." },
  provided: { label: "from your brief", tone: "info", title: "On your list; URL/ID taken from your brief, not opened." },
  "link-needed": { label: "link needed", tone: "warn", title: "On your list but no URL was given — add it to content/resources.json." },
  unverified: { label: "unverified extra", tone: "muted", title: "Not on your list." },
};

export function ResourceItem({ r, weeks, compact = false }: { r: Resource; weeks?: number[]; compact?: boolean }) {
  const { resourcesDone } = useAppState();
  const done = Boolean(resourcesDone[r.id]);
  const st = STATUS[r.status];
  if (compact) {
    return (
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${done ? "border-good/40 bg-good-soft/40" : "border-line bg-surface"}`}>
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" checked={done} onChange={() => toggleResource(r.id)} aria-label={`Mark ${r.title} done`} />
        <span className="min-w-0 text-sm">
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className={`font-medium underline-offset-2 hover:underline ${done ? "text-muted line-through" : ""}`}>
              {r.title} ↗
            </a>
          ) : (
            <span className="font-medium">{r.title}</span>
          )}
          <span className="mt-0.5 block text-xs text-muted">
            {r.type} · ≈ {r.minutes >= 120 ? `${Math.round(r.minutes / 60)} h` : `${r.minutes} min`}
            {r.status === "link-needed" && " · link needed"}
          </span>
        </span>
      </label>
    );
  }
  return (
    <div id={r.id} className={`scroll-mt-24 rounded-lg border p-4 ${done ? "border-good/40 bg-good-soft/40" : "border-line bg-surface"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{r.type}</Badge>
            <Badge tone={st.tone} title={st.title}>
              {st.label}
            </Badge>
            <span className="tabular text-xs text-muted">≈ {r.minutes >= 120 ? `${Math.round(r.minutes / 60)} h` : `${r.minutes} min`}</span>
          </div>
          <h3 className="mt-1.5 font-medium">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                {r.title} ↗
              </a>
            ) : (
              r.title
            )}
          </h3>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={done} onChange={() => toggleResource(r.id)} />
          {done ? "Done" : "To do"}
        </label>
      </div>
      <p className="mt-2 text-sm text-muted">{r.why}</p>
      {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
      {r.id === "foc-ch2" && (
        <Link href="/textbook" className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
          Open the chapter 2 reading guide →
        </Link>
      )}
      {r.doNotCopy && <p className="mt-1 text-xs text-muted">Use for practice only — none of its questions are copied into TUPrep.</p>}
      {weeks && weeks.length > 0 && <p className="mt-1 text-xs text-muted">Scheduled in week {weeks.map((w) => w + 1).join(", ")}.</p>}
    </div>
  );
}
