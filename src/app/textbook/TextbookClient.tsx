"use client";

import Link from "next/link";
import { useState } from "react";
import { CHAPTER_2, partKey, TEXTBOOK } from "@/content/textbook";
import { IconArrow, IconCheck } from "@/components/Icons";
import { Badge, ButtonLink, Card, PageHeader, PartBadge, ProgressBar } from "@/components/ui";
import { toggleResource, useAppState, useHydrated } from "@/lib/store";

export function TextbookClient({ hasLocalPdf }: { hasLocalPdf: boolean }) {
  const hydrated = useHydrated();
  const { resourcesDone } = useAppState();
  const [showReader, setShowReader] = useState(true);
  const required = CHAPTER_2.flatMap((s) => s.parts.filter((p) => !p.skip).map((p) => partKey(s.id, p.title)));
  const done = hydrated ? required.filter((k) => resourcesDone[k]).length : 0;
  const hours = Math.round(CHAPTER_2.reduce((a, s) => a + s.minutes, 0) / 60);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logic textbook"
        subtitle="TU Delft's own preparation text for Systematic Reasoning & Logical Thinking: chapter 2 of Delftse Foundations of Computation. Read it alongside units L1–L5 and skip the starred (*) sections."
      />

      <Card className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{TEXTBOOK.title}</h2>
          <p className="text-sm text-muted">
            {TEXTBOOK.authors} · {TEXTBOOK.edition} · {TEXTBOOK.publisher} ·{" "}
            <a className="underline underline-offset-2" href={TEXTBOOK.licenseUrl} target="_blank" rel="noopener noreferrer">
              {TEXTBOOK.license}
            </a>
          </p>
          <div className="mt-3 max-w-md">
            <ProgressBar value={(done / required.length) * 100} tone={done === required.length ? "good" : "accent"} label="Chapter 2 progress" />
            <p className="tabular mt-1 text-xs text-muted">
              {done} of {required.length} required parts read · about {hours} h in total
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={TEXTBOOK.interactive}>Read online</ButtonLink>
          <ButtonLink href={TEXTBOOK.pdf} variant="secondary">
            PDF (TU Delft)
          </ButtonLink>
        </div>
      </Card>

      <div className={`grid grid-cols-1 gap-6 ${hasLocalPdf && showReader ? "xl:grid-cols-[400px_minmax(0,1fr)]" : ""}`}>
        {/* Reading guide */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Chapter 2 reading guide</h2>
            {hasLocalPdf && (
              <button type="button" className="ml-auto text-sm text-muted hover:text-fg" onClick={() => setShowReader((v) => !v)}>
                {showReader ? "Hide reader" : "Show reader"}
              </button>
            )}
          </div>
          {CHAPTER_2.map((s) => {
            const req = s.parts.filter((p) => !p.skip);
            const sDone = hydrated ? req.filter((p) => resourcesDone[partKey(s.id, p.title)]).length : 0;
            const complete = sDone === req.length;
            return (
              <Card key={s.id} className={complete ? "border-good/40" : ""}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-sm font-semibold text-muted">§{s.id}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                  {complete && hydrated && (
                    <span className="flex items-center gap-1 text-xs font-medium text-good">
                      <IconCheck className="h-4 w-4" /> done
                    </span>
                  )}
                  <span className="tabular ml-auto text-xs text-muted">≈ {s.minutes} min</span>
                </div>
                <p className="mt-1 text-sm text-muted">{s.why}</p>
                <ul className="mt-3 space-y-1">
                  {s.parts.map((p) => {
                    const key = partKey(s.id, p.title);
                    if (p.skip)
                      return (
                        <li key={key} className="flex items-center gap-3 py-1 text-sm text-muted">
                          <span className="w-4 text-center">*</span>
                          <span className="line-through decoration-muted/60">{p.title}</span>
                          <Badge>skip</Badge>
                        </li>
                      );
                    const checked = Boolean(resourcesDone[key]);
                    return (
                      <li key={key}>
                        <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-surface-2">
                          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={() => toggleResource(key)} />
                          <span className={checked ? "text-muted line-through" : ""}>{p.title}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
                  <span className="text-muted">Then practise:</span>
                  {s.units.map((u) => (
                    <Link key={u} href={`/units/${u}?tab=practice`} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 hover:border-accent">
                      <PartBadge part="logic">{u}</PartBadge>
                      <IconArrow className="h-3.5 w-3.5 text-muted" />
                    </Link>
                  ))}
                </div>
              </Card>
            );
          })}
          <Card className="text-sm text-muted">
            <h3 className="font-semibold text-fg">How to study it</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Read one section, then do the matching TUPrep unit practice the same day.</li>
              <li>Do the book&apos;s exercises on paper, then check your reasoning against the unit&apos;s worked solutions or ask the unit tutor.</li>
              <li>Skip every section marked with * — TU Delft says they are not needed for the test.</li>
            </ul>
          </Card>
        </section>

        {/* Reader */}
        {hasLocalPdf && showReader ? (
          <section aria-label="Textbook reader" className="xl:sticky xl:top-28 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <iframe title={`${TEXTBOOK.title} (PDF)`} src={TEXTBOOK.localPdf} className="h-[75vh] w-full" />
            </div>
            <p className="mt-2 text-xs text-muted">
              Copy of the official PDF, shared under {TEXTBOOK.license} © {TEXTBOOK.authors}. Use the PDF&apos;s bookmarks to jump to chapter 2.{" "}
              <a className="underline" href={TEXTBOOK.localPdf} target="_blank" rel="noopener noreferrer">
                Open full screen
              </a>
            </p>
          </section>
        ) : (
          !hasLocalPdf && (
            <Card className="text-sm text-muted">
              TU Delft&apos;s site doesn&apos;t allow its book to be shown inside other sites, so use <strong className="text-fg">Read online</strong> or the PDF button above. A copy of the PDF
              can also be added to this site (see the README) to read it right here.
            </Card>
          )
        )}
      </div>
    </div>
  );
}
