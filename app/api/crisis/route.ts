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

  // ~3 days baseline + urgent bills
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

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();

    const cashOnHand = Number(body?.cashOnHand || 0);
    const weeklyBaseline = Number(body?.weeklyBaseline || 350);
    const tone = (body?.tone as Tone) || "calm";

    const buckets = Array.isArray(body?.buckets) ? body.buckets : [];
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    // TODO later: compute bills due soon from buckets/entries if you store due dates there.
    const billsDueSoon = 0;

    const stabilityScore = computeStabilityScore({ cashOnHand, weeklyBaseline, billsDueSoon });

    const toneInstruction =
      tone === "calm"
        ? "Tone: calm, grounding, supportive, reassuring."
        : tone === "direct"
        ? "Tone: direct, tactical, concise."
        : "Tone: strict survival mode—no fluff, hard boundaries, aggressive prioritization.";

    const system = `You are a practical financial triage assistant.
Return VALID JSON ONLY. No markdown. No extra keys.
${toneInstruction}
Use the buckets and entries if present; if empty, still produce a useful plan.`;

    const userPayload = {
      cashOnHand,
      weeklyBaseline,
      billsDueSoon,
      stabilityScoreHint: stabilityScore,
      buckets,
      entries,
      request: "Generate a 72-hour crisis plan and priority funding amounts.",
    };

    // ✅ JSON Schema the model must follow
    const schema = {
      name: "crisis_plan",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          headline: { type: "string" },
          stabilityScore: { type: "number" },
          top3ActionsNow: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 6,
          },
          priorityFunding: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                bucketName: { type: "string" },
                recommendedAmount: { type: "number" },
                why: { type: "string" },
              },
              required: ["bucketName", "recommendedAmount", "why"],
            },
          },
          plan72h: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 10,
          },
        },
        required: ["headline", "stabilityScore", "top3ActionsNow", "priorityFunding", "plan72h"],
      },
    };

    // ✅ Updated OpenAI call for your SDK version:
    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_schema", json_schema: schema },
    });

    const text = resp.output_text || "";

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // If the model ever returns non-JSON, still don’t break the app:
      json = fallbackPlan({ cashOnHand, weeklyBaseline });
    }

    // Force our score in if model returns something weird:
    if (typeof json.stabilityScore !== "number") json.stabilityScore = stabilityScore;

    return NextResponse.json(json, { status: 200 });
  } catch (err: any) {
    // Always return a usable plan even on AI failure
    const safe = fallbackPlan(body);
    safe._debug = err?.message ? String(err.message) : "Unknown error"; // optional: remove later
    return NextResponse.json(safe, { status: 200 });
  }
}
