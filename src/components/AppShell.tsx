"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/units", label: "Units" },
  { href: "/practice", label: "Practice" },
  { href: "/mock", label: "Mocks" },
  { href: "/review", label: "Review" },
  { href: "/analytics", label: "Analytics" },
  { href: "/resources", label: "Resources" },
  { href: "/ask", label: "Ask" },
];

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
  const [open, setOpen] = useState(false);
  const { activeRun } = useAppState();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // Keep the test UI distraction-free while a timed section is running.
  const inMock = pathname === "/run" && activeRun?.sections[activeRun.sectionIndex]?.deadline != null && !activeRun.onBreak;
  const showResume = Boolean(activeRun) && pathname !== "/run";


  return (
    <div className="flex min-h-screen flex-col">
      <ThemeController />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {!inMock && (
        <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid grid-cols-1 h-7 w-7 place-items-center rounded-md bg-accent text-sm font-bold text-white dark:text-bg">
                TU
              </span>
              <span>TUPrep</span>
            </Link>
            <nav aria-label="Main" className="ml-2 hidden items-center gap-0.5 lg:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    isActive(n.href) ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/exams"
                aria-current={isActive("/exams") ? "page" : undefined}
                className="hidden rounded-md px-3 py-1.5 text-sm text-muted hover:text-fg lg:block"
              >
                Exam info
              </Link>
              <Link
                href="/settings"
                aria-current={isActive("/settings") ? "page" : undefined}
                className="hidden rounded-md px-3 py-1.5 text-sm text-muted hover:text-fg lg:block"
              >
                Settings
              </Link>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-sm lg:hidden"
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((o) => !o)}
              >
                Menu
              </button>
            </div>
          </div>
          {open && (
            <nav id="mobile-nav" aria-label="Main" className="grid grid-cols-2 border-t border-line px-4 py-2 lg:hidden">
              {[...NAV, { href: "/exams", label: "Exam info" }, { href: "/settings", label: "Settings" }].map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm ${isActive(n.href) ? "bg-surface-2 font-medium" : "text-muted"}`}
                >
                  {n.label}
                </Link>
              ))}
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
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        {children}
      </main>
      {!inMock && (
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted">
            TUPrep is an independent study tool and is not affiliated with TU Delft or TU/e. All questions are original practice
            items in the style of the tests, not real test items. Check the official procedure pages for current dates and rules.
            Your progress is stored only in this browser; only tutor chat messages are sent to a server (Anthropic API).
          </div>
        </footer>
      )}
    </div>
  );
}
