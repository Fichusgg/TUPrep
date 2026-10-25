import type { Metadata } from "next";
import { Suspense } from "react";
import { MockClient } from "./MockClient";

export const metadata: Metadata = { title: "Mock exams" };

export default function MockPage() {
  return (
    <Suspense fallback={null}>
      <MockClient />
    </Suspense>
  );
}
