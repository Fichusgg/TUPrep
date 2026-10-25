import type { Metadata } from "next";
import { ReviewClient } from "./ReviewClient";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return <ReviewClient />;
}
