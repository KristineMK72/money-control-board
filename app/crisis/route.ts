import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  return NextResponse.json({
    headline: "Okay — we’ve got this.",
    top3ActionsNow: [
      "List what must be paid in the next 72 hours.",
      "Pause anything non-essential.",
      "Take one income action today."
    ],
    priorityFunding: [],
    debug: body
  });
}
