import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // important for OpenAI SDK on Vercel

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Payload = {
  cashOnHand: number;
  paycheck: null | { date: string; amount: number };
  weeklyBaseline: number;
  buckets: any[];
  entries: any[];
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY env var." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Payload;

    const prompt = `
You are a calm financial triage assistant.
Return ONLY valid JSON with this exact shape:

{
  "headline": string,
  "top3ActionsNow": string[],
  "priorityFunding": [
    { "bucketName": string, "recommendedAmount": number, "why": string }
  ]
}

Rules:
- Keep it practical and non-judgmental.
- Focus on the next 72 hours.
- Use cashOnHand, paycheck (if provided), weeklyBaseline, buckets (target/saved/dueDate/priority) and recent entries.
- If data is missing, say so in "why" and recommend the smallest safe step.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              cashOnHand: body.cashOnHand,
              paycheck: body.paycheck,
              weeklyBaseline: body.weeklyBaseline,
              buckets: body.buckets,
              entries: body.entries,
            },
            null,
            2
          ),
        },
      ],
    });

    const text =
      response.output_text?.trim() ||
      "";

    // Best-effort parse. If it fails, return raw.
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json);
    } catch {
      return NextResponse.json(
        { error: "Model did not return valid JSON.", raw: text },
        { status: 200 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
