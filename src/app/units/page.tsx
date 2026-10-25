import type { Metadata } from "next";
import { PARTS } from "@/content";
import { PageHeader } from "@/components/ui";
import { orderedUnits } from "@/lib/progress";
import { UnitCard } from "./UnitCard";

export const metadata: Metadata = { title: "Units" };

export default function UnitsPage() {
  return (
    <div className="space-y-10">
      <PageHeader title="Learn" subtitle="Work through each unit in order: read the key ideas, practise, pass the timed test, then keep your mistakes in review." />
      {PARTS.map((p) => (
        <section key={p.id}>
          <h2 className="text-xl font-semibold">{p.title}</h2>
          <p className="mb-4 text-sm text-muted">
            {p.delft ? `TU Delft: ${p.delft}` : "Not in the 2027-2028 TU Delft CST"} · TU/e: {p.tue}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedUnits(p.id).map((u, i) => (
              <UnitCard key={u.id} unitId={u.id} step={i + 1} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
