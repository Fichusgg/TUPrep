import type { Metadata } from "next";
import { PARTS, unitsForPart } from "@/content";
import { PageHeader } from "@/components/ui";
import { UnitCard } from "./UnitCard";

export const metadata: Metadata = { title: "Units" };

export default function UnitsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Units"
        subtitle="Every unit has an overview with key ideas and common traps, the resources to use, practice by difficulty and tag, a timed test, a Q&A space and your error log."
      />
      {PARTS.map((p) => (
        <section key={p.id}>
          <h2 className="text-lg font-semibold">{p.title}</h2>
          <p className="mb-3 text-sm text-muted">
            {p.delft ? `TU Delft: ${p.delft}` : "Not part of the 2027-2028 TU Delft CST"} · TU/e: {p.tue}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unitsForPart(p.id).map((u) => (
              <UnitCard key={u.id} unitId={u.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
