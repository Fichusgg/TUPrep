import Link from "next/link";
import type { PartId } from "@/content/schema";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white dark:text-bg hover:opacity-90",
  secondary: "border border-line bg-surface hover:bg-surface-2",
  ghost: "hover:bg-surface-2 text-muted hover:text-fg",
  danger: "border border-bad/40 text-bad hover:bg-bad-soft",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" className={`${btnBase} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${btnBase} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function ProgressBar({ value, tone = "accent", label }: { value: number; tone?: "accent" | "good" | "bad"; label?: string }) {
  const color = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-accent";
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
}

const PART_COLORS: Record<PartId, string> = {
  math: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  logic: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  algorithmic: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function PartBadge({ part, children }: { part: PartId; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PART_COLORS[part]}`}>{children}</span>;
}

export type Tone = "good" | "warn" | "bad" | "info" | "muted";
const TONES: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-accent-soft text-accent",
  muted: "bg-surface-2 text-muted",
};

export function Badge({ tone = "muted", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ExamBadge({ exam }: { exam: "delft" | "tue" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${exam === "delft" ? "bg-delft" : "bg-tue"}`}>
      {exam === "delft" ? "TU Delft" : "TU/e"}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, label }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm transition ${value === t.id ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs tabular">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DifficultyDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Difficulty ${level} of 3`} title={`Difficulty ${level}/3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "bg-fg/70" : "bg-fg/15"}`} />
      ))}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
