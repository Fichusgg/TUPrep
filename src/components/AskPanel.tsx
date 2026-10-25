"use client";

import { useEffect, useRef, useState } from "react";
import { UNIT_BY_ID } from "@/content";
import { formatDate } from "@/lib/format";
import { appendChat, clearChat, deleteAsk, uid, upsertAsk, useAppState, type AskEntry } from "@/lib/store";
import { RichText } from "./RichText";
import { Badge, Button, Card, EmptyState } from "./ui";

function touch(e: AskEntry, patch: Partial<AskEntry>) {
  upsertAsk({ ...e, ...patch, updatedAt: Date.now() });
}

/** "My questions" log for a unit (or all units). Works without any API key. */
export function QuestionLog({ unit }: { unit?: string }) {
  const { ask } = useAppState();
  const [text, setText] = useState("");
  const [tagUnit, setTagUnit] = useState(unit ?? "L1");
  const [filter, setFilter] = useState<"open" | "answered" | "all">("open");
  const list = ask.filter((a) => (!unit || a.unit === unit) && (filter === "all" || a.status === filter)).sort((a, b) => b.updatedAt - a.updatedAt);


  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const now = Date.now();
          upsertAsk({ id: uid(), unit: unit ?? tagUnit, text: text.trim(), status: "open", note: "", link: "", createdAt: now, updatedAt: now });
          setText("");
        }}
      >
        <label htmlFor="ask-text" className="text-sm font-medium">
          Write down a question you want to resolve
        </label>
        <textarea id="ask-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" placeholder="e.g. Why is “p only if q” the same as p → q?" />
        <div className="flex flex-wrap items-center gap-2">
          {!unit && (
            <label className="text-sm">
              Unit{" "}
              <select value={tagUnit} onChange={(e) => setTagUnit(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1">
                {Object.keys(UNIT_BY_ID).map((u) => (
                  <option key={u} value={u}>
                    {u} {UNIT_BY_ID[u].title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" disabled={!text.trim()}>
            Add question
          </Button>
          <div className="ml-auto flex gap-1 text-sm" role="group" aria-label="Filter questions">
            {(["open", "answered", "all"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-2 py-1 capitalize ${filter === f ? "bg-surface-2 font-medium" : "text-muted"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </form>
      {list.length === 0 ? (
        <EmptyState title={filter === "open" ? "No open questions" : "Nothing here yet"} />
      ) : (
        list.map((a) => (
          <div key={a.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start gap-2">
              {!unit && <Badge tone="info">{a.unit}</Badge>}
              <p className="min-w-0 flex-1 text-sm font-medium">{a.text}</p>
              <button type="button" onClick={() => touch(a, { status: a.status === "open" ? "answered" : "open" })} className={`rounded-full px-2 py-0.5 text-xs ${a.status === "open" ? "bg-warn/15 text-warn" : "bg-good-soft text-good"}`}>
                {a.status === "open" ? "Open — mark answered" : "Answered — reopen"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
              <textarea defaultValue={a.note} onBlur={(e) => touch(a, { note: e.target.value })} rows={2} placeholder="Note / answer" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
              <input defaultValue={a.link} onBlur={(e) => touch(a, { link: e.target.value })} placeholder="Link or question id (e.g. L5-014)" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <div className="mt-2 flex text-xs text-muted">
              <span>
                {formatDate(a.createdAt, { day: "numeric", month: "short" })}
                {a.link && (
                  <>
                    {" · "}
                    <a className="underline" href={/^[A-Z0-9]+-[A-Z0-9-]+$/.test(a.link) ? `/practice?ids=${encodeURIComponent(a.link)}` : a.link} target={a.link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      open link
                    </a>
                  </>
                )}
              </span>
              <button type="button" className="ml-auto hover:text-bad" onClick={() => deleteAsk(a.id)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Socratic AI tutor for one unit. Calls /api/tutor; shows setup instructions when no API key is configured. */
export function TutorChat({ unit }: { unit: string }) {
  const { chats, activeRun } = useAppState();
  const messages = chats[unit] ?? [];
  const [status, setStatus] = useState<{ configured: boolean; missing: string[] } | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const testOpen = Boolean(activeRun);

  useEffect(() => {
    fetch("/api/tutor")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, missing: ["server"] }));
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const userMsg = { role: "user" as const, content: text, at: Date.now() };
    appendChat(unit, userMsg);
    setBusy(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, timedTestOpen: testOpen, messages: [...messages, userMsg].slice(-20).map(({ role, content }) => ({ role, content })) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? `Request failed (${res.status})`);
      appendChat(unit, { role: "assistant", content: data.reply, at: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (status && !status.configured) {
    return (
      <Card className="space-y-2 text-sm">
        <h3 className="font-semibold">AI tutor — not set up</h3>
        <p className="text-muted">The tutor needs an Anthropic API key on the server. Your question log above works without it.</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>
            Copy <code className="rounded bg-surface-2 px-1">.env.example</code> to <code className="rounded bg-surface-2 px-1">.env.local</code> (local) or add the variables in your Vercel project settings.
          </li>
          <li>
            Set <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code> and <code className="rounded bg-surface-2 px-1">ANTHROPIC_MODEL</code> (a model id, e.g. the one suggested in .env.example).
          </li>
          <li>Restart the dev server (or redeploy).</li>
        </ol>
        {status.missing.length > 0 && <p className="text-xs text-muted">Missing: {status.missing.join(", ")}</p>}
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">AI tutor — {unit}</h3>
        <span className="text-xs text-muted">Socratic: hints first, full solutions only when you ask after trying.</span>
        {messages.length > 0 && (
          <button type="button" className="ml-auto text-xs text-muted hover:text-fg" onClick={() => clearChat(unit)}>
            Clear chat
          </button>
        )}
      </div>
      {testOpen && <p className="rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">A timed test is open — the tutor will only give general hints until you finish it.</p>}
      <div className="max-h-[420px] space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-muted">Ask about anything in this unit — a concept, a question you got wrong, or how to start a problem.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-8 bg-accent-soft" : "mr-8 bg-surface-2"}`}>
            <RichText text={m.content} />
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Thinking…</p>}
        <div ref={endRef} />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`tutor-${unit}`} className="sr-only">
          Message the tutor
        </label>
        <input id={`tutor-${unit}`} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the tutor…" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
        <Button type="submit" disabled={busy || !input.trim() || status === null}>
          Send
        </Button>
      </form>
      <p className="text-xs text-muted">Messages in this chat are sent to Anthropic via this site&apos;s server. Nothing else leaves your browser.</p>
    </Card>
  );
}
