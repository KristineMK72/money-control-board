import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const systemPrompt = `
You are a calm, grounded financial triage assistant.

Return ONLY valid JSON in this exact structure:

{
  "headline": string,
  "top3ActionsNow": string[],
  "priorityFunding": [
    { "bucketName": string, "recommendedAmount": number, "why": string }
  ]
}

Rules:
- Be calming.
- Focus on next 72 hours.
- Prioritize housing, utilities, food, transportation.
- If data is incomplete, recommend smallest stabilizing action.
- No lectures. No shame.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify(body, null, 2),
        },
      ],
    });

    const text = response.output_text?.trim() || "";

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        error: "AI did not return valid JSON",
        raw: text,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
