import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UNIT_BY_ID, UNITS } from "@/content";
import { readUnitMarkdown } from "@/content/server";
import { UnitTabs } from "./UnitTabs";

export function generateStaticParams() {
  return UNITS.map((u) => ({ unit: u.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ unit: string }> }): Promise<Metadata> {
  const { unit } = await params;
  const u = UNIT_BY_ID[unit];
  return { title: u ? `${u.id} ${u.title}` : "Unit" };
}

export default async function UnitPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
  if (!UNIT_BY_ID[unit]) notFound();
  return (
    <Suspense fallback={null}>
      <UnitTabs unitId={unit} summary={readUnitMarkdown(unit)} />
    </Suspense>
  );
}
