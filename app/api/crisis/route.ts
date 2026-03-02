import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const body = await req.json();

  // Body should include: buckets, entries, weeklyBaseline, maybe "cashOnHand" + "paycheck"
  const { buckets, entries, weeklyBaseline, cashOnHand, paycheck } = body;

  const system = `
You are a calm financial triage assistant. 
You do NOT give legal advice and do NOT promise outcomes.
You help prioritize bills, avoid late fees, and create a clear 72-hour and 7-day action plan.
Always be supportive, practical, and concise.
Return JSON only with a fixed schema.
`;

  const user = {
    cashOnHand,
    paycheck,
    weeklyBaseline,
    buckets,
    entries,
  };

  const schemaHint = `
Return JSON like:
{
  "headline": string,
  "top3ActionsNow": string[],
  "plan72Hours": string[],
  "plan7Days": string[],
  "priorityFunding": Array<{ "bucketKey": string, "bucketName": string, "recommendedAmount": number, "why": string }>,
  "calls": Array<{ "who": string, "script": string }>,
  "doNotDo": string[]
}
`;

  const resp = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ schemaHint, user }) },
    ],
    temperature: 0.3,
  });

  const text = resp.choices[0]?.message?.content ?? "{}";

  // Try parse; fallback safely
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({
      headline: "I can help, but I couldn't format the plan correctly.",
      top3ActionsNow: ["Try again."],
      plan72Hours: [],
      plan7Days: [],
      priorityFunding: [],
      calls: [],
      doNotDo: [],
      raw: text,
    });
  }
}
