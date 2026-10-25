"use client";

import Link from "next/link";
import { QuestionLog } from "@/components/AskPanel";
import { Card, PageHeader } from "@/components/ui";
import { UNITS } from "@/content";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ask" subtitle="All your questions across units. The AI tutor lives on each unit page (Ask tab), so it can use that unit's context." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <QuestionLog />
        <Card>
          <h2 className="text-sm font-semibold">Tutor per unit</h2>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
            {UNITS.map((u) => (
              <li key={u.id}>
                <Link className="hover:underline" href={`/units/${u.id}?tab=ask`}>
                  {u.id} tutor
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
