import { streamText, tool } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { createClient } from "@/lib/supabase/server";
import {
  accessDeniedStreamResponse,
  requireFullAccess,
} from "@/lib/access/require-access";
import { SECTIONS } from "@/lib/constants";
import { DebriefPlanSchema } from "@/lib/coach/debrief-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Debrief coach — a post-test conversational agent.
 *
 * The client streams messages in, and sends along a structured `snapshot` of
 * how the just-finished session went (score, per-section accuracy, soft/hard
 * misses, time, mode, baseline). The model:
 *   1. Responds in a warm, blunt tutor voice.
 *   2. Can call the `propose_plan` tool to produce a structured plan object.
 *   3. Can call the `commit_plan` tool when the user agrees; the client shows
 *      a "Start Practice" CTA that ships the plan to /practice/start.
 *
 * Tools use `execute` that just echoes args back so the toolInvocation is
 * resolved on the client and we can render it in the UI.
 */

const SectionStat = z.object({
  code: z.string(),
  title: z.string().optional(),
  total: z.number(),
  correct: z.number(),
  accuracy: z.number().nullable().optional(),
  baselineAccuracy: z.number().nullable().optional(),
});

const Snapshot = z.object({
  mode: z.enum(["assessment", "practice", "mistakes", "mock", "final"]),
  sessionId: z.string().uuid(),
  total: z.number(),
  correct: z.number(),
  accuracy: z.number(),
  passBar: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  hintUsed: z.number().nullable().optional(),
  coachedPct: z.number().nullable().optional(),
  bySection: z.array(SectionStat).default([]),
  weakestCodes: z.array(z.string()).default([]),
  strongestCodes: z.array(z.string()).default([]),
  prior: z
    .object({
      label: z.string(),
      accuracy: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  currentPlan: DebriefPlanSchema.nullable().optional(),
});

type Snapshot = z.infer<typeof Snapshot>;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1),
  snapshot: Snapshot,
});

const SECTION_TITLE: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.code, s.title]),
);

function buildSystem(snapshot: Snapshot) {
  const modeLabel =
    snapshot.mode === "mock" ? "Mock Exam"
    : snapshot.mode === "practice" ? "Practice"
    : snapshot.mode === "mistakes" ? "Mistakes Test"
    : snapshot.mode === "final" ? "Final Exam"
    : "Assessment";

  const sectionLines = (snapshot.bySection ?? [])
    .map((s) => {
      const acc = s.accuracy == null ? "—" : `${Math.round(s.accuracy)}%`;
      const baseline = s.baselineAccuracy == null ? "—" : `${Math.round(s.baselineAccuracy)}%`;
      const delta =
        s.accuracy != null && s.baselineAccuracy != null
          ? ` (Δ ${Math.round(s.accuracy - s.baselineAccuracy)})`
          : "";
      return `  - ${s.code} ${s.title ?? SECTION_TITLE[s.code] ?? ""}: ${s.correct}/${s.total} = ${acc}  baseline ${baseline}${delta}`;
    })
    .join("\n");

  const prior = snapshot.prior
    ? `\nPrior baseline (${snapshot.prior.label}): ${
        snapshot.prior.accuracy == null ? "—" : `${Math.round(snapshot.prior.accuracy)}%`
      }`
    : "";

  return `You are a warm, blunt South Carolina real estate exam tutor running a post-test "debrief" with your student.
Your job is to have a short, clarifying conversation about how this ${modeLabel} went, then propose a practical plan for the NEXT practice session.

VOICE
- Honest first, encouraging second. Plain English. Short sentences.
- Use "you". No bullet points. No emoji. Never reveal letters or answers.
- 2 to 4 short sentences per message unless the student asks for depth.

FLOW
1. Open with ONE real, specific observation from the data (a weak section, a strong section, or a time/hint signal). Then ask ONE open question ("what felt hardest?" / "where did you second-guess yourself?").
2. Listen. Reflect back. Teach only when it helps them move forward.
3. When you have enough signal (usually after 1–2 turns), call the propose_plan tool to suggest a focused plan: which sections to amplify (focus), which to downweight (avoid), how many questions, and a difficulty bias.
4. If the student says "tweak it", "more B3", "shorter", "harder", etc. — call propose_plan again with revised args.
5. When the student says they're ready or happy ("let's go", "sounds good", "start it"), call commit_plan with the agreed plan and invite them to begin.

TOOL USE RULES
- Only call propose_plan AFTER at least one student message (don't propose before the conversation starts).
- The plan's "focus" MUST be drawn from the weakest sections in the data — never invent section codes.
- Keep total in 10–40 for most students unless they ask for long.
- "note" should be one short line (<=200 chars) written in second person.
- After commit_plan, end the turn with a short send-off sentence.

SESSION SNAPSHOT (ground truth — do not invent beyond this):
Mode: ${modeLabel}
Score: ${snapshot.correct}/${snapshot.total} (${Math.round(snapshot.accuracy)}%)${
    snapshot.passBar != null ? `  pass bar: ${Math.round(snapshot.passBar)}%` : ""
  }
Hints used: ${snapshot.hintUsed ?? "—"}  Coached: ${snapshot.coachedPct != null ? `${Math.round(snapshot.coachedPct)}%` : "—"}
Duration: ${
    snapshot.durationMs ? `${Math.round(snapshot.durationMs / 60000)} min` : "—"
  }
Weakest: ${snapshot.weakestCodes.join(", ") || "—"}
Strongest: ${snapshot.strongestCodes.join(", ") || "—"}${prior}
Per-section:
${sectionLines || "  (none)"}
`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const guard = await requireFullAccess(supabase);
  if (!guard.ok) return accessDeniedStreamResponse(guard);

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "bad_request", detail: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { messages, snapshot } = parsed.data;
  const system = buildSystem(snapshot);

  const result = streamText({
    model: getModel(),
    system,
    messages,
    temperature: 0.5,
    maxTokens: 700,
    tools: {
      propose_plan: tool({
        description:
          "Propose a focused, concrete plan for the student's NEXT practice run. Renders as an interactive plan card on the client.",
        parameters: DebriefPlanSchema,
        execute: async (args) => args,
      }),
      commit_plan: tool({
        description:
          "The student has agreed to this plan. The client will surface a primary 'Start Practice' CTA.",
        parameters: DebriefPlanSchema,
        execute: async (args) => ({ ...args, committed: true }),
      }),
    },
    toolChoice: "auto",
    maxSteps: 3,
  });

  return result.toDataStreamResponse();
}
