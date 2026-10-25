import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeClient } from "./PracticeClient";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticeClient />
    </Suspense>
  );
}
