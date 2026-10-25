import type { Metadata } from "next";
import { ResourcesClient } from "./ResourcesClient";

export const metadata: Metadata = { title: "Resources" };

export default function ResourcesPage() {
  return <ResourcesClient />;
}
