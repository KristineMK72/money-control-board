"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { STORAGE_KEY } from "@/lib/money/storageKey";

type Bucket = { id?: string; name?: string; title?: string; remaining?: number; amount?: number };
type Entry = { id?: string; amount?: number; date?: string; kind?: string; note?: string };

export default function CrisisPage() {
  const [cashOnHand, setCashOnHand] = useState(0);
  const [weeklyBaseline, setWeeklyBaseline] = useState(350);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setBuckets(parsed.buckets || []);
      setEntries(parsed.entries || []);
    } catch {
      // ignore
    }
  }, []);

  async function runPlan() {
    setLoading(true);
    setData(null);
    setError(null);

    try {
      const res = await fetch("/api/crisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashOnHand,
          weeklyBaseline,
          buckets,
          entries,
        }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);

      setData(JSON.parse(text));
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="text-3xl font-black">Crisis Mode</div>
        <div className="mt-2 text-sm text-white/70">Calm financial triage for the next 72 hours.</div>

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
            <span className="text-xs font-semibold text-white/75">Cash on hand</span>
            <input
              inputMode="decimal"
              value={String(cashOnHand)}
              onChange={(e) => setCashOnHand(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-white/75">Weekly baseline</span>
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

        <div className="mt-3 text-xs text-white/55">
          Using <b>{buckets.length}</b> buckets + <b>{entries.length}</b> income entries (from local storage).
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-3xl border border-red-400/20 bg-red-500/10 p-5">
          <div className="text-lg font-black">Crisis plan failed</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-white/80">{error}</pre>
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xl font-black">{data.headline}</div>

            <div className="mt-3 text-sm font-black text-white/90">Top actions now</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
              {(data.top3ActionsNow || []).map((x: string, i: number) => (
                <li key={i}>{x}</li>
              ))}
            </ul>

            <div className="mt-4 text-sm font-black text-white/90">Priority funding</div>
            <div className="mt-2 grid gap-2">
              {(data.priorityFunding || []).map((p: any, i: number) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black">{p.bucketName}</div>
                    <div className="font-black">{Number(p.recommendedAmount || 0).toFixed(2)}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/70">{p.why}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
