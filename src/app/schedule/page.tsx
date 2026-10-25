import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleClient } from "./ScheduleClient";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <ScheduleClient />
    </Suspense>
  );
}
