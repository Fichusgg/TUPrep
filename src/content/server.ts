import "server-only";
import fs from "node:fs";
import path from "node:path";

/** Unit summaries live in content/units/<ID>.md. Read at build time (static pages) or in route handlers. */
export function readUnitMarkdown(unitId: string): string {
  if (!/^[A-Z]\d$/.test(unitId)) return "";
  const file = path.join(process.cwd(), "content", "units", `${unitId}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
