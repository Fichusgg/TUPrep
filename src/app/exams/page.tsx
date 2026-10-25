import type { Metadata } from "next";
import { scheduleConfig } from "@config/schedule.config";
import { FACTS } from "@/content/facts";
import { Badge, Card, ExamBadge, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Exam info" };

export default function ExamsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Exam info" subtitle="What the official 2027-2028 documents say (read on 24 October 2026). Anything not published is marked ESTIMATED in config/schedule.config.ts." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(["delft", "tue"] as const).map((k) => (
          <Card key={k} className="space-y-4">
            <div className="flex items-center gap-2">
              <ExamBadge exam={k} />
              <h2 className="font-semibold">{FACTS[k].title}</h2>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              {FACTS[k].points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div>
              <h3 className="text-sm font-semibold">Sources</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {FACTS[k].sources.map(([label, url]) => (
                  <li key={url}>
                    <a className="text-accent underline underline-offset-2" href={url} target="_blank" rel="noopener noreferrer">
                      {label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">Dates used by the planner</h2>
        <ul className="mt-2 divide-y divide-line text-sm">
          {[...scheduleConfig.tests.map((t) => ({ label: t.label, date: t.date, status: t.status })), ...scheduleConfig.keyDates].map((d) => (
            <li key={d.label} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{d.label}</span>
              <span className="flex items-center gap-2 text-muted">
                {formatDate(d.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                <Badge tone={d.status === "CONFIRMED" ? "good" : "warn"}>{d.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Proctoring & equipment checklist</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Laptop/desktop with webcam and microphone; charger plugged in.</li>
          <li>Stable internet (wired if possible); close other apps and browser tabs; disable notifications.</li>
          <li>Quiet room, nobody else present, phone switched off and out of sight; no second screen, headphones or calculator.</li>
          <li>ID ready; do the official proctoring trial run (TU Delft 9–16 Feb; TU/e instructions by 5 Feb).</li>
          <li>Scrap paper and pens if allowed by the instructions you receive.</li>
        </ul>
      </Card>
    </div>
  );
}
