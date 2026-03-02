"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "money-control-board-v4";

export default function CrisisPage() {
  const [cashOnHand, setCashOnHand] = useState(0);
  const [weeklyBaseline, setWeeklyBaseline] = useState(350);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  async function runPlan() {
    setLoading(true);
    setData(null);

    const res = await fetch("/api/crisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashOnHand,
        weeklyBaseline,
      }),
    });

    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white font-sans">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="text-3xl font-black">Crisis Mode</div>
        <div className="mt-2 text-sm text-white/70">
          Calm financial triage for the next 72 hours.
        </div>

        <div className="mt-4">
          <Link
            href="/money"
            className="inline-flex items-center rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
          >
            ← Back to Board
          </Link>
        </div>

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-white/75">
              Cash on hand
            </span>
            <input
              inputMode="decimal"
              value={String(cashOnHand)}
              onChange={(e) => setCashOnHand(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-white/75">
              Weekly baseline
            </span>
            <input
              inputMode="decimal"
              value={String(weeklyBaseline)}
              onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none"
            />
          </label>
        </div>

        <button
          onClick={runPlan}
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
        >
          {loading ? "Building plan…" : "Generate crisis plan"}
        </button>
      </div>

      {data && (
        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xl font-black">{data.headline}</div>

            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">
              {(data.top3ActionsNow || []).map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
