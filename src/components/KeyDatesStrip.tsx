"use client";

import { useState } from "react";
import { scheduleConfig } from "@config/schedule.config";
import { formatDate } from "@/lib/format";
import { daysBetween, todayIso } from "@/lib/schedule";
import { addKeyDate, removeKeyDate, useAppState, useHydrated } from "@/lib/store";
import { Badge, Button } from "./ui";

/** Test dates and key dates from config, plus dates you add yourself. */
export function KeyDatesStrip({ editable = false }: { editable?: boolean }) {
  const hydrated = useHydrated();
  const { keyDates } = useAppState();
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const today = todayIso();
  const items = [
    ...scheduleConfig.tests.map((t) => ({ id: t.id, label: t.label, date: t.date, status: t.status as string, test: true, mine: false })),
    ...scheduleConfig.keyDates.map((k) => ({ id: k.label, label: k.label, date: k.date, status: k.status as string, test: false, mine: false })),
    ...keyDates.map((k) => ({ id: k.id, label: k.label, date: k.date, status: "yours", test: false, mine: true })),
  ]
    .filter((x) => x.date >= today || x.test)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {items.map((k) => {
          const d = hydrated ? daysBetween(today, k.date) : null;
          return (
            <div key={k.id} className={`min-w-[160px] shrink-0 rounded-lg border px-3 py-2 text-xs ${k.test ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"}`}>
              <div className="flex items-center gap-1">
                <span className="font-medium text-fg">{formatDate(k.date, { day: "numeric", month: "short" })}</span>
                {d !== null && <span className="text-muted">{d > 0 ? `in ${d}d` : d === 0 ? "today" : "passed"}</span>}
                {k.status === "ESTIMATED" && <Badge tone="warn">ESTIMATED</Badge>}
                {k.mine && (
                  <button type="button" className="ml-auto text-muted hover:text-bad" aria-label={`Remove ${k.label}`} onClick={() => removeKeyDate(k.id)}>
                    ×
                  </button>
                )}
              </div>
              <div className="mt-0.5 text-muted">{k.label}</div>
            </div>
          );
        })}
      </div>
      {editable && (
        <form
          className="flex flex-wrap items-end gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim() || !date) return;
            addKeyDate({ label: label.trim(), date });
            setLabel("");
            setDate("");
          }}
        >
          <label>
            <span className="block text-xs text-muted">Add your own date</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. IB mock exams" className="rounded-md border border-line bg-surface px-2 py-1" />
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="rounded-md border border-line bg-surface px-2 py-1" />
          <Button type="submit" variant="secondary" disabled={!label.trim() || !date}>
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
