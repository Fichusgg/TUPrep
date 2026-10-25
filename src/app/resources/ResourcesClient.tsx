"use client";

import { useMemo } from "react";
import { PARTS, RESOURCES, unitsForPart } from "@/content";
import { ResourceItem } from "@/components/ResourceItem";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { buildSchedule } from "@/lib/schedule";
import { useAppState } from "@/lib/store";

export function ResourcesClient() {
  const { resourcesDone } = useAppState();
  const weeksByResource = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const w of buildSchedule()) for (const t of w.tasks) if (t.resourceId) m.set(t.resourceId, [...new Set([...(m.get(t.resourceId) ?? []), w.index])]);
    return m;
  }, []);
  const done = RESOURCES.filter((r) => resourcesDone[r.id]).length;
  // Each resource is listed once, under the first unit it is mapped to; the unit page lists all of its resources.
  const general = RESOURCES.filter((r) => r.units.length === 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources"
        subtitle="Only the resources from your list (plus two official procedure pages, marked as extras). Grouped by part and unit, with why each is useful, an estimated time and a done/to-do toggle."
        actions={<Badge tone="info">{done}/{RESOURCES.length} done</Badge>}
      />
      <Card className="space-y-2">
        <ProgressBar value={(done / RESOURCES.length) * 100} label="Resources done" />
        <p className="text-xs text-muted">
          Status: <Badge tone="good">link checked</Badge> opened on 24 Oct 2026 · <Badge tone="info">from your brief</Badge> URL/ID copied from your brief · <Badge tone="warn">link needed</Badge> on your list but no URL given — add it
          in content/resources.json · <Badge>unverified extra</Badge> not on your list.
        </p>
      </Card>
      {PARTS.map((p) => (
        <section key={p.id} className="space-y-4">
          <h2 className="text-lg font-semibold">{p.title}</h2>
          {unitsForPart(p.id).map((u) => {
            const list = RESOURCES.filter((r) => r.units[0] === u.id);
            if (!list.length) return null;
            return (
              <div key={u.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted">
                  {u.id} · {u.title}
                </h3>
                <p className="text-xs text-muted">Also used for: {[...new Set(list.flatMap((r) => r.units))].filter((x) => x !== u.id).join(", ") || "—"}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {list.map((r) => (
                    <ResourceItem key={r.id} r={r} weeks={weeksByResource.get(r.id)} />

                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">General & official pages</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {general.map((r) => (
            <ResourceItem key={r.id} r={r} weeks={weeksByResource.get(r.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}
