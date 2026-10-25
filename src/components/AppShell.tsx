"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { useClock } from "@/lib/useClock";
import { IconLearn, IconPlan, IconPractice, IconProgress, IconSettings, IconToday } from "./Icons";

/** Five learner-centred sections; each lists the routes it owns (first = landing page). */
const SECTIONS = [
  { label: "Today", icon: IconToday, links: [{ href: "/", label: "Today" }] },
  { label: "Learn", icon: IconLearn, links: [{ href: "/units", label: "Units" }, { href: "/resources", label: "Resources" }, { href: "/ask", label: "My questions" }] },
  { label: "Practice", icon: IconPractice, links: [{ href: "/practice", label: "Practice" }, { href: "/review", label: "Review mistakes" }, { href: "/mock", label: "Mock exams" }] },
  { label: "Plan", icon: IconPlan, links: [{ href: "/schedule", label: "Schedule" }, { href: "/exams", label: "Exam info" }] },
  { label: "Progress", icon: IconProgress, links: [{ href: "/analytics", label: "Progress" }] },
] as const;

const matches = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

function sectionFor(pathname: string) {
  if (pathname.startsWith("/results") || pathname.startsWith("/run")) return SECTIONS[2];
  return SECTIONS.find((s) => s.links.some((l) => matches(pathname, l.href)));
}

function ThemeController() {
  const { settings } = useAppState();
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeRun, errors } = useAppState();
  const current = sectionFor(pathname);
  // Keep the test UI distraction-free while a timed section is running.
  const inTest = pathname === "/run" && activeRun?.sections[activeRun.sectionIndex]?.deadline != null && !activeRun.onBreak;
  const showResume = Boolean(activeRun) && pathname !== "/run";
  const now = useClock(60_000);
  const due = Object.values(errors).filter((e) => !e.resolved && e.due <= now).length;

  return (
    <div className="flex min-h-screen flex-col">
      <ThemeController />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {!inTest && (
        <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white dark:text-bg">
                TU
              </span>
              <span>TUPrep</span>
            </Link>
            <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
              {SECTIONS.map((s) => {
                const active = current === s;
                const Icon = s.icon;
                return (
                  <Link
                    key={s.label}
                    href={s.links[0].href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "bg-accent-soft font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {s.label}
                    {s.label === "Practice" && due > 0 && <span className="tabular rounded-full bg-warn/20 px-1.5 text-xs text-warn">{due}</span>}
                  </Link>
                );
              })}
            </nav>
            <Link href="/settings" aria-label="Settings" aria-current={pathname === "/settings" ? "page" : undefined} className="ml-auto rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
              <IconSettings />
            </Link>
          </div>
          {current && current.links.length > 1 && (
            <nav aria-label={`${current.label} pages`} className="border-t border-line">
              <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1.5">
                {current.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={matches(pathname, l.href) ? "page" : undefined}
                    className={`shrink-0 rounded-md px-3 py-1 text-sm ${matches(pathname, l.href) ? "font-medium text-fg underline decoration-accent decoration-2 underline-offset-8" : "text-muted hover:text-fg"}`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </header>
      )}
      {showResume && (
        <div className="border-b border-warn/30 bg-warn/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <span>
              <strong>{activeRun!.title}</strong> is in progress — its timer keeps running.
            </span>
            <Link href="/run" className="ml-auto rounded-md bg-warn/20 px-3 py-1 font-medium text-warn">
              Resume
            </Link>
          </div>
        </div>
      )}
      <main id="main" className={`mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8 ${inTest ? "" : "pb-24 md:pb-8"}`}>
        {children}
      </main>
      {!inTest && (
        <footer className="hidden border-t border-line md:block">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted">
            TUPrep is an independent study tool and is not affiliated with TU Delft or TU/e. All questions are original practice
            items in the style of the tests, not real test items. Check the official procedure pages for current dates and rules.
            Your progress is stored only in this browser; only tutor chat messages are sent to a server (Anthropic API).
          </div>
        </footer>
      )}
      {!inTest && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {SECTIONS.map((s) => {
              const active = current === s;
              const Icon = s.icon;
              return (
                <Link key={s.label} href={s.links[0].href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-medium text-accent" : "text-muted"}`}>
                  <Icon />
                  {s.label}
                  {s.label === "Practice" && due > 0 && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-warn" aria-label={`${due} reviews due`} />}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
