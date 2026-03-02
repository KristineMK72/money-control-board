"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "money-control-board-v4";

type Bucket = {
  key: string;
  name: string;
  target?: number;
  saved?: number;
  dueDate?: string;
  priority?: 1 | 2 | 3;
};

type Entry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  source?: string;
  amount: number;
};

type CrisisResponse = {
  headline?: string;
  top3ActionsNow?: string[];
  priorityFunding?: { bucketName: string; recommendedAmount: number; why?: string }[];
  debug?: any;
};

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export default function CrisisPage() {
  const [cashOnHand, setCashOnHand] = useState<number>(0);
  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CrisisResponse | null>(null);

  // load saved board data (optional but useful for AI)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setBuckets(Array.isArray(parsed?.buckets) ? parsed.buckets : []);
      setEntries(Array.isArray(parsed?.entries) ? parsed.entries : []);
    } catch {
      // ignore
    }
  }, []);

  const canRun = useMemo(() => !loading, [loading]);

  async function runPlan() {
    setLoading(true);
    setData(null);

    try {
      const res = await fetch("/api/crisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashOnHand: clampMoney(cashOnHand),
          weeklyBaseline: clampMoney(weeklyBaseline),
          buckets,
          entries,
        }),
      });

      const text = await res.text();

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // not JSON
      }

      if (!res.ok) {
        setData({
          headline: "Crisis plan failed (API error)",
          top3ActionsNow: [],
          priorityFunding: [],
          debug: {
            status: res.status,
            statusText: res.statusText,
            body: text?.slice(0, 2000),
          },
        });
        return;
      }

      if (!json) {
        setData({
          headline: "Crisis plan failed (no JSON returned)",
          top3ActionsNow: [],
          priorityFunding: [],
          debug: { body: text?.slice(0, 2000) },
        });
        return;
      }

      setData(json as CrisisResponse);
    } catch (err: any) {
      setData({
        headline: "Crisis plan failed (network/client error)",
        top3ActionsNow: [],
        priorityFunding: [],
        debug: { message: String(err?.message || err) },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_18px_55px_rgba(0,0,0,0.35)]">
        <div className="text-3xl font-black tracking-tight">Crisis Mode</div>
        <div className="mt-2 text-sm text-white/70">
          Calm financial triage for the next 72 hours.
        </div>

        <div className="mt-4">
          <Link
            href="/money"
            className="inline-flex items-center rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/14"
          >
            ← Back to Board
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-white/75">Cash on hand</span>
            <input
              inputMode="decimal"
              value={Number.isFinite(cashOnHand) ? String(cashOnHand) : "0"}
              onChange={(e) => setCashOnHand(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
              placeholder="0"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-white/75">Weekly baseline</span>
            <input
              inputMode="decimal"
              value={Number.isFinite(weeklyBaseline) ? String(weeklyBaseline) : "0"}
              onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
              placeholder="350"
            />
          </label>
        </div>

        <button
          onClick={runPlan}
          disabled={!canRun}
          className="mt-5 w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-black text-white hover:bg-white/20 disabled:opacity-60"
        >
          {loading ? "Building plan…" : "Generate crisis plan"}
        </button>

        <div className="mt-3 text-[11px] text-white/50">
          Using {buckets.length} buckets + {entries.length} income entries (from local storage).
        </div>
      </div>

      {data ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xl font-black">{data.headline || "Crisis plan"}</div>

            {(data.top3ActionsNow?.length || 0) > 0 ? (
              <>
                <div className="mt-3 text-sm font-black text-white/90">Top actions now</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                  {(data.top3ActionsNow || []).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </>
            ) : null}

            {(data.priorityFunding?.length || 0) > 0 ? (
              <>
                <div className="mt-4 text-sm font-black text-white/90">Priority funding</div>
                <div className="mt-2 grid gap-2">
                  {(data.priorityFunding || []).map((p, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-black">{p.bucketName}</div>
                        <div className="font-black">{clampMoney(p.recommendedAmount).toFixed(2)}</div>
                      </div>
                      {p.why ? <div className="mt-1 text-xs text-white/70">{p.why}</div> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {data.debug ? (
              <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
                {JSON.stringify(data.debug, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
