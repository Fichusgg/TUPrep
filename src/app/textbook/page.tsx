import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { TEXTBOOK } from "@/content/textbook";
import { TextbookClient } from "./TextbookClient";

export const metadata: Metadata = { title: "Logic textbook" };

export default function TextbookPage() {
  // The reader is shown only if a copy of the PDF has been added to /public (see README).
  const hasLocalPdf = fs.existsSync(path.join(process.cwd(), "public", TEXTBOOK.localPdf));
  return <TextbookClient hasLocalPdf={hasLocalPdf} />;
}
