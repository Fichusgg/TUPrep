export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(isoOrMs: string | number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(`${isoOrMs}T12:00:00`);
  return d.toLocaleDateString("en-GB", opts);
}

/** Whole days from today until an ISO date (negative when in the past). */
export function daysUntil(iso: string, now = Date.now()): number {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86_400_000);
}
