"use client";

import Link from "next/link";
import { UNIT_BY_ID } from "@/content";
import { IconArrow, IconCheck } from "@/components/Icons";
import { Badge, PartBadge, ProgressBar } from "@/components/ui";
import { STATUS_LABEL, unitProgress } from "@/lib/progress";
import { apStatus, todayIso } from "@/lib/schedule";
import { useAppState, useHydrated } from "@/lib/store";

export function UnitCard({ unitId, step }: { unitId: string; step: number }) {
  const u = UNIT_BY_ID[unitId];
  const hydrated = useHydrated();
  const state = useAppState();
  const p = unitProgress(state, u);
  const ap = u.part === "math" && hydrated ? apStatus(u.id, todayIso()) : null;
  const passed = hydrated && p.status === "passed";
  return (
    <Link href={`/units/${u.id}`} className="group block h-full">
      <div className={`flex h-full flex-col rounded-2xl border bg-surface p-5 transition group-hover:border-accent ${passed ? "border-good/40" : "border-line"}`}>
        <div className="flex items-center gap-2">
          <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${passed ? "bg-good text-white dark:text-bg" : "bg-surface-2 text-muted"}`}>
            {passed ? <IconCheck className="h-4 w-4" /> : step}
          </span>
          <PartBadge part={u.part}>{u.id}</PartBadge>
          {hydrated && <Badge tone={p.status === "passed" ? "good" : p.status === "in-progress" ? "info" : "muted"}>{STATUS_LABEL[p.status]}</Badge>}
        </div>
        <h3 className="mt-3 font-semibold">{u.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{u.covers}</p>
        {ap && (
          <p className="mt-2">
            <Badge tone={ap.tone === "good" ? "good" : ap.tone === "warn" ? "warn" : "info"}>{ap.label}</Badge>
          </p>
        )}
        <div className="mt-auto space-y-2 pt-4">
          <ProgressBar value={(p.seen / p.total) * 100} tone={passed ? "good" : "accent"} label={`${u.id} questions seen`} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="tabular">
              {p.seen}/{p.total} seen{p.accuracy !== null ? ` · ${p.accuracy}%` : ""}
              {p.openErrors > 0 ? ` · ${p.openErrors} to review` : ""}
            </span>
            <span className="flex items-center gap-1 font-medium text-accent">
              {p.status === "not-started" ? "Start" : passed ? "Revisit" : "Continue"} <IconArrow className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
