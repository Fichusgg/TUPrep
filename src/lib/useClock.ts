"use client";

import { useEffect, useState } from "react";

/** Current time as state (pure during render); re-ticks every `intervalMs` when given. */
export function useClock(intervalMs = 0): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!intervalMs) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
