"use client";

import Link from "next/link";
import { bankForUnit, UNIT_BY_ID } from "@/content";
import { Badge, Card, PartBadge, ProgressBar } from "@/components/ui";
import { apStatus, todayIso } from "@/lib/schedule";
import { byUnit } from "@/lib/stats";
import { useAppState, useHydrated } from "@/lib/store";

export function UnitCard({ unitId }: { unitId: string }) {
  const u = UNIT_BY_ID[unitId];
  const hydrated = useHydrated();
  const { attempts, errors } = useAppState();
  const t = byUnit(attempts, u.id);
  const seen = new Set(attempts.filter((a) => a.unit === u.id).map((a) => a.qid)).size;
  const total = bankForUnit(u.id).length;
  const open = Object.values(errors).filter((e) => e.unit === u.id && !e.resolved).length;
  const ap = u.part === "math" && hydrated ? apStatus(u.id, todayIso()) : null;
  return (
    <Link href={`/units/${u.id}`} className="group">
      <Card className="h-full transition group-hover:border-accent">
        <div className="flex flex-wrap items-center gap-2">
          <PartBadge part={u.part}>{u.id}</PartBadge>
          {ap && <Badge tone={ap.tone === "good" ? "good" : ap.tone === "warn" ? "warn" : "info"}>{ap.label}</Badge>}
          {open > 0 && <Badge tone="bad">{open} in error log</Badge>}
        </div>
        <h3 className="mt-2 font-medium">{u.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{u.covers}</p>
        <div className="mt-3 space-y-1">
          <ProgressBar value={(seen / total) * 100} label={`${u.id} questions seen`} />
          <p className="tabular text-xs text-muted">
            {seen}/{total} questions seen{t.attempts ? ` · ${t.accuracy}% accuracy` : ""}
          </p>
        </div>
      </Card>
    </Link>
  );
}
