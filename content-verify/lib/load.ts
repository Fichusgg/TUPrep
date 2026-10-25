import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const CONTENT = path.join(ROOT, "content");

export function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(CONTENT, rel), "utf8"));
}

export function listJson(dir: string): string[] {
  const abs = path.join(CONTENT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(dir, f));
}

export function readText(rel: string): string | null {
  const abs = path.join(CONTENT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}
