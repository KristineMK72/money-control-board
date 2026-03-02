// app/api/crisis/route.ts
import OpenAI from "openai";

export const runtime = "nodejs"; // ensures Node runtime (not Edge)

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Bucket = {
  key: string;
  name: string;
  target: number;
  saved: number;
  dueDate?: string;
  priority?: 1 | 2 | 3;
  balance?: number;
  apr?: number;
};

type Entry = {
  id: string;
  dateISO: string;
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations?: Record<string, number>;
};

function safeNumber(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY env var on server." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const cashOnHand = safeNumber(body.cashOnHand);
    const weeklyBaseline = safeNumber(body.weeklyBaseline);
    const paycheck = body.paycheck && body.paycheck.date
      ? { date: String(body.paycheck.date), amount: safeNumber(body.paycheck.amount) }
      : null;

    const buckets: Bucket[] = Array.isArray(body.buckets) ? body.buckets : [];
    const entries: Entry[] = Array.isArray(body.entries) ? body.entries : [];

    // Keep prompt payload small & safe
    const compact = {
      cashOnHand,
      weeklyBaseline,
      paycheck,
      buckets: buckets.map((b) => ({
        name: b.name,
        target: safeNumber(b.target),
        saved: safeNumber(b.saved),
        dueDate: b.dueDate ?? null,
        priority: b.priority ?? null,
        balance: b.balance ?? null,
        apr: b.apr ?? null,
      })),
      entries: entries
        .slice(-30) // last 30 only
        .map((e) => ({
          dateISO: e.dateISO,
          source: e.source,
          amount: safeNumber(e.amount),
          note: e.note ?? null,
        })),
    };

    const system = `
You are a calm, practical financial triage assistant.
Goal: generate a 72-hour crisis plan using the user's buckets + income log.
Rules:
- Be compassionate, clear, action-oriented.
- Prefer paying essentials and avoiding late fees.
- Never give legal/medical advice.
Return ONLY valid JSON matching this schema:

{
  "headline": string,
  "top3ActionsNow": string[],
  "priorityFunding": [
    { "bucketName": string, "recommendedAmount": number, "why": string }
  ]
}

recommendedAmount must be a number (no currency symbols).
    `.trim();

    const user = `
User data:
${JSON.stringify(compact, null, 2)}

Make the plan.
    `.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const text = resp.choices?.[0]?.message?.content ?? "{}";
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = { headline: "Crisis plan", top3ActionsNow: [], priorityFunding: [] };
    }

    // Defensive cleanup so UI never crashes
    const out = {
      headline: String(json.headline ?? "Crisis plan"),
      top3ActionsNow: Array.isArray(json.top3ActionsNow) ? json.top3ActionsNow.map(String).slice(0, 3) : [],
      priorityFunding: Array.isArray(json.priorityFunding)
        ? json.priorityFunding.slice(0, 8).map((p: any) => ({
            bucketName: String(p.bucketName ?? "Unknown"),
            recommendedAmount: safeNumber(p.recommendedAmount),
            why: String(p.why ?? ""),
          }))
        : [],
    };

    return Response.json(out);
  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? "Unknown error in /api/crisis" },
      { status: 500 }
    );
  }
}
