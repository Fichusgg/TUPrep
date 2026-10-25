"use client";

import { useRef, useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";
import { exportJson, importJson, resetAll, updateSettings, useAppState, useHydrated, type Settings } from "@/lib/store";

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line p-1" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 text-sm ${value === v ? "bg-surface-2 font-medium" : "text-muted hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function SettingsClient() {
  const hydrated = useHydrated();
  const state = useAppState();
  const { settings } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [vwo, setVwo] = useState<string | null>(null);

  if (!hydrated) return null;

  const vwoValue = vwo ?? (settings.vwoAverage === null ? "" : String(settings.vwoAverage));

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuprep-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      importJson(await file.text());
      setVwo(null);
      setMessage({ tone: "good", text: "Backup restored." });
    } catch (e) {
      setMessage({ tone: "bad", text: `Could not import: ${(e as Error).message}` });
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Settings" subtitle="Everything is stored locally in this browser. Only tutor chat messages are sent to a server." />

      <Card className="space-y-6">
        <div>
          <h2 className="font-medium">Dates, hours and pacing</h2>
          <p className="text-sm text-muted">
            Test dates, the plan start, weekly hours (normal / heavy / light weeks), phases, the study split and the exam pace live in{" "}
            <code className="rounded bg-surface-2 px-1">config/schedule.config.ts</code>. Edit that file and the schedule, countdowns and timed tests regenerate.
          </p>
        </div>

        <div>
          <h2 className="font-medium">VWO / IB grade average</h2>
          <p className="mb-2 text-sm text-muted">Optional. Counts for 10% of the TU/e ranking; used only in the TU/e weighted mock score (grade × 10 as a percentage).</p>
          <div className="flex items-center gap-2">
            <label htmlFor="vwo" className="sr-only">
              Grade average
            </label>
            <input
              id="vwo"
              inputMode="decimal"
              placeholder="e.g. 7.4"
              value={vwoValue}
              onChange={(e) => {
                const raw = e.target.value;
                setVwo(raw);
                const n = Number(raw.replace(",", "."));
                if (raw.trim() === "") updateSettings({ vwoAverage: null });
                else if (Number.isFinite(n) && n >= 1 && n <= 10) updateSettings({ vwoAverage: Math.round(n * 100) / 100 });
              }}
              className="tabular w-32 rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
            />
            <span className="text-sm text-muted">{settings.vwoAverage !== null ? `saved: ${settings.vwoAverage}` : "not set"}</span>
          </div>
        </div>

        <div>
          <h2 className="font-medium">Theme</h2>
          <div className="mt-2">
            <Segmented<Settings["theme"]>
              label="Theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                ["system", "System"],
                ["light", "Light"],
                ["dark", "Dark"],
              ]}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-medium">Your data</h2>
          <p className="text-sm text-muted">
            {state.attempts.length} answers, {state.runs.length} timed tests/mocks, {Object.keys(state.errors).length} error-log entries, {Object.keys(state.tasksDone).length} ticked
            tasks and {state.ask.length} questions are stored in this browser (localStorage, behind a storage adapter). Export a backup regularly — clearing browser data deletes it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            Export all progress (.json)
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import progress…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Delete all progress, mock results and settings from this browser? This cannot be undone.")) {
                resetAll();
                setVwo(null);
                setMessage({ tone: "good", text: "All data deleted." });
              }
            }}
          >
            Reset everything
          </Button>
        </div>
        {message && (
          <p role="status" className={`text-sm ${message.tone === "good" ? "text-good" : "text-bad"}`}>
            {message.text}
          </p>
        )}
      </Card>
    </div>
  );
}
