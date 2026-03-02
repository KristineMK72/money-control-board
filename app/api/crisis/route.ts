import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Tone = "calm" | "direct" | "survival";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function computeStabilityScore(args: {
  cashOnHand: number;
  weeklyBaseline: number;
  billsDueSoon: number;
}) {
  const { cashOnHand, weeklyBaseline, billsDueSoon } = args;

  const need72h = weeklyBaseline * 0.45 + billsDueSoon;
  const ratio = need72h <= 0 ? 1 : cashOnHand / need72h;

  const raw =
    ratio >= 1.5 ? 85 :
    ratio >= 1.0 ? 70 :
    ratio >= 0.7 ? 55 :
    ratio >= 0.4 ? 35 :
    20;

  return clamp(Math.round(raw), 0, 100);
}

function fallbackPlan(input: any) {
  const cashOnHand = Number(input?.cashOnHand || 0);
  const weeklyBaseline = Number(input?.weeklyBaseline || 350);

  const billsDueSoon = 0;
  const stabilityScore = computeStabilityScore({ cashOnHand, weeklyBaseline, billsDueSoon });

  const essentials = Math.min(cashOnHand, Math.round(weeklyBaseline * 0.6));
  const reserve = Math.max(0, cashOnHand - essentials);

  return {
    headline: "Immediate 72-Hour Plan: Prioritize Essentials with Limited Funds",
    stabilityScore,
    top3ActionsNow: [
      "List essentials only (food, gas, housing, utilities) and pause everything else for 72 hours.",
      "If any bills are due in the next 3 days, call and request an extension/hardship option.",
      "Set a hard cash floor (emergency reserve) and don’t cross it unless safety/transportation demands it.",
    ],
    priorityFunding: [
      {
        bucketName: "Essentials",
        recommendedAmount: essentials,
        why: "Covers your baseline essentials first so the next 72 hours stay stable.",
      },
      {
        bucketName: "Emergency Reserve",
        recommendedAmount: reserve,
        why: "Keeps a cushion for surprises (transport, meds, urgent needs).",
      },
    ],
    plan72h: [
      "Today: fund Essentials first, then set aside a minimum emergency cushion.",
      "Next 24h: identify any due-now bills and request extensions where needed.",
      "Next 48–72h: focus on the fastest income action (one job / one sale / one payout).",
    ],
  };
}

function coercePlanShape(json: any, stabilityScore: number) {
  const safe = typeof json === "object" && json ? json : {};

  if (typeof safe.headline !== "string") safe.headline = "72-Hour Crisis Plan";
  if (typeof safe.stabilityScore !== "number") safe.stabilityScore = stabilityScore;

  if (!Array.isArray(safe.top3ActionsNow)) safe.top3ActionsNow = [];
  if (safe.top3ActionsNow.length < 3) {
    safe.top3ActionsNow = [
      "Pause all non-essential spending for 72 hours.",
      "Cover food/gas/housing basics first.",
      "Call any due-now billers and request hardship/extension.",
    ];
  }

  if (!Array.isArray(safe.priorityFunding)) safe.priorityFunding = [];
  if (safe.priorityFunding.length < 2) {
    safe.priorityFunding = fallbackPlan({}).priorityFunding;
  }

  if (!Array.isArray(safe.plan72h)) safe.plan72h = fallbackPlan({}).plan72h;

  // Trim to reasonable sizes
  safe.top3ActionsNow = safe.top3ActionsNow.slice(0, 6);
  safe.priorityFunding = safe.priorityFunding.slice(0, 6);
  safe.plan72h = safe.plan72h.slice(0, 10);

  return safe;
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();

    const cashOnHand = Number(body?.cashOnHand || 0);
    const weeklyBaseline = Number(body?.weeklyBaseline || 350);
    const tone = (body?.tone as Tone) || "calm";

    const buckets = Array.isArray(body?.buckets) ? body.buckets : [];
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    const billsDueSoon = 0; // optional future enhancement
    const stabilityScore = computeStabilityScore({ cashOnHand, weeklyBaseline, billsDueSoon });

    const toneInstruction =
      tone === "calm"
        ? "Tone: calm, grounding, supportive, reassuring."
        : tone === "direct"
        ? "Tone: direct, tactical, concise."
        : "Tone: strict survival mode—no fluff, hard boundaries, aggressive prioritization.";

    const schemaHint = {
      headline: "string",
      stabilityScore: "number 0-100",
      top3ActionsNow: ["string", "string", "string"],
      priorityFunding: [
        { bucketName: "string", recommendedAmount: 0, why: "string" },
        { bucketName: "string", recommendedAmount: 0, why: "string" },
      ],
      plan72h: ["string", "string", "string"],
    };

    const userPayload = {
      cashOnHand,
      weeklyBaseline,
      billsDueSoon,
      stabilityScoreHint: stabilityScore,
      buckets,
      entries,
    };

    const system = `You are a practical financial triage assistant.
Return ONLY valid JSON (no markdown, no commentary).
The JSON MUST match this shape (keys exactly; no extra keys):
${JSON.stringify(schemaHint, null, 2)}
${toneInstruction}
If buckets/entries are empty, still produce a useful plan.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      // ✅ Supported in your SDK:
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const text = completion.choices?.[0]?.message?.content || "{}";

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = fallbackPlan({ cashOnHand, weeklyBaseline });
    }

    json = coercePlanShape(json, stabilityScore);

    return NextResponse.json(json, { status: 200 });
  } catch (err: any) {
    const safe = fallbackPlan(body);
    // Optional debug; remove later if you want:
    safe._debug = err?.message ? String(err.message) : "Unknown error";
    return NextResponse.json(safe, { status: 200 });
  }
}
