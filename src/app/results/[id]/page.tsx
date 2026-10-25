import { ResultsClient } from "./ResultsClient";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsClient id={decodeURIComponent(id)} />;
}
