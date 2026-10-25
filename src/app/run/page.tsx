"use client";

import Link from "next/link";
import { RunPlayer } from "@/components/RunPlayer";
import { EmptyState } from "@/components/ui";
import { useAppState, useHydrated } from "@/lib/store";

export default function RunPage() {
  const hydrated = useHydrated();
  const { activeRun } = useAppState();
  if (!hydrated) return null;
  if (!activeRun)
    return (
      <EmptyState title="No test in progress">
        Start a <Link className="underline" href="/units">unit timed test</Link> or a <Link className="underline" href="/mock">mock exam</Link>.
      </EmptyState>
    );
  return <RunPlayer run={activeRun} />;
}
