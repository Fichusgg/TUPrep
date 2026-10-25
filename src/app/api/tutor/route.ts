import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { UNIT_BY_ID } from "@/content";
import { readUnitMarkdown } from "@/content/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function config() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  const missing = [!apiKey && "ANTHROPIC_API_KEY", !model && "ANTHROPIC_MODEL"].filter(Boolean) as string[];
  return { apiKey, model, missing };
}

/** GET: is the tutor configured? (Never returns the key itself.) */
export async function GET() {
  const { missing } = config();
  return Response.json({ configured: missing.length === 0, missing });
}

const Body = z.object({
  unit: z.string(),
  timedTestOpen: z.boolean().default(false),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

function systemPrompt(unitId: string, timedTestOpen: boolean): string {
  const unit = UNIT_BY_ID[unitId];
  const summary = readUnitMarkdown(unitId);
  return [
    "You are a patient, Socratic tutor helping a pre-university student prepare for the TU Delft BSc Computer Science & Engineering Cognitive Skills Test (Mathematics; Systematic Reasoning & Logical Thinking) and the TU/e CSE selection tests (Mathematics, Logical Reasoning, Algorithmic Thinking).",
    `The student is working on unit ${unit.id} — ${unit.title}. It covers: ${unit.covers}`,
    "Unit summary the student has read (key ideas and common traps):",
    summary,
    "How to tutor:",
    "- Lead with questions and hints. Give one hint at a time and let the student try again.",
    "- Only give a complete worked solution when the student explicitly asks for it after attempting the problem, or after two hints. Then explain each step briefly.",
    "- Use the unit's notation: ¬ ∧ ∨ → ↔ for logic, pseudocode with ← and 1-indexed arrays for algorithms. Write maths in $…$ (KaTeX).",
    "- The real tests allow no calculator and require exact answers; practise that way.",
    "- Keep replies short (under ~180 words) unless the student asks for more. Point to the unit's ideas and traps when relevant.",
    "- If you are unsure about an official fact (dates, weights, rules), say so and refer the student to the official TU Delft / TU/e pages instead of guessing.",
    timedTestOpen
      ? "IMPORTANT: the student currently has a timed test open in the app. Do not solve, check or give the answer to any specific problem. Only discuss general concepts or strategy, and remind them to finish the test first."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** POST: one tutor turn. The model comes from ANTHROPIC_MODEL; nothing is hard-coded. */
export async function POST(req: Request) {
  const { apiKey, model, missing } = config();
  if (missing.length) return Response.json({ error: `Tutor not configured: set ${missing.join(" and ")}.` }, { status: 503 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!UNIT_BY_ID[body.unit]) return Response.json({ error: "Unknown unit." }, { status: 400 });
  if (body.messages[0].role !== "user") return Response.json({ error: "Conversation must start with a user message." }, { status: 400 });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: model!,
      max_tokens: 4000,
      system: systemPrompt(body.unit, body.timedTestOpen),
      messages: body.messages,
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ reply: "I can't help with that request. Try rephrasing it as a question about this unit." });
    }
    const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return Response.json({ reply: reply || "(no answer — try rephrasing)" });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "The Anthropic API key was rejected." }, { status: 502 });
    if (e instanceof Anthropic.NotFoundError) return Response.json({ error: "The model in ANTHROPIC_MODEL was not found." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Rate limited by the API — wait a moment and try again." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: `Anthropic API error (${e.status ?? "network"}).` }, { status: 502 });
    return Response.json({ error: "Tutor request failed." }, { status: 500 });
  }
}
