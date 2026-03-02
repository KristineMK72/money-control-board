"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "money-control-board-v4";

type Tone = "calm" | "direct" | "survival";

export default function CrisisPage() {
  const [cashOnHand, setCashOnHand] = useState(0);
  const [weeklyBaseline, setWeeklyBaseline] = useState(350);
  const [tone, setTone] = useState<Tone>("calm");

  const [buckets, setBuckets] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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

  const counts = useMemo(() => {
    return { buckets: buckets.length, entries: entries.length };
  }, [buckets, entries]);

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
          tone,
          buckets,
          entries,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error?.message ||
          json?.error ||
          json?.body ||
          `Request failed (${res.status})`;
        setError(String(msg));
        return;
      }

      setData(json);
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white font-sans">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
        <div className="text-4xl font-black tracking-tight">Crisis Mode</div>
        <div className="mt-2 text-sm text-white/70">
          Calm financial triage for the next 72 hours.
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/money"
            className="inline-flex items-center rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
          >
            ← Back to Board
          </Link>

          <div className="ml-auto text-xs text-white/55">
            Using {counts.buckets} buckets + {counts.entries} income entries (from local storage).
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-white/75">Cash on hand</span>
              <input
                inputMode="decimal"
                value={String(cashOnHand)}
                onChange={(e) => setCashOnHand(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/12 bg-black/35 px-5 py-4 text-base text-white outline-none"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-white/75">Weekly baseline</span>
              <input
                inputMode="decimal"
                value={String(weeklyBaseline)}
                onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/12 bg-black/35 px-5 py-4 text-base text-white outline-none"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold text-white/75">Tone</span>
            <div className="flex flex-wrap gap-2">
              {(["calm", "direct", "survival"] as Tone[]).map((t) => {
                const active = tone === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={[
                      "rounded-full px-4 py-2 text-xs font-semibold transition",
                      active ? "bg-white/20 text-white" : "bg-white/8 text-white/70 hover:bg-white/12",
                    ].join(" ")}
                  >
                    {t === "calm" ? "Calm & supportive" : t === "direct" ? "Direct & tactical" : "Strict survival mode"}
                  </button>
                );
              })}
            </div>
          </label>
        </div>

        <button
          onClick={runPlan}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-white/15 px-6 py-4 text-base font-black text-white hover:bg-white/20 disabled:opacity-60"
        >
          {loading ? "Building plan…" : "Generate crisis plan"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
          <div className="text-lg font-black">Crisis plan failed</div>
          <div className="mt-2 break-words text-white/85">{error}</div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-3">
          {/* Score + headline */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="text-2xl font-black">{data.headline}</div>
              {typeof data.stabilityScore === "number" ? (
                <div className="rounded-2xl bg-black/25 px-4 py-2 text-center">
                  <div className="text-xs text-white/60">Stability</div>
                  <div className="text-2xl font-black">{data.stabilityScore}</div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="text-sm font-black text-white/90">Top actions now</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                {(data.top3ActionsNow || []).map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Priority funding */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="text-sm font-black text-white/90">Priority funding</div>
            <div className="mt-3 grid gap-3">
              {(data.priorityFunding || []).map((p: any, i: number) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-black">{p.bucketName}</div>
                    <div className="text-base font-black">{Number(p.recommendedAmount || 0).toFixed(2)}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/70">{p.why}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 72-hour plan */}
          {Array.isArray(data.plan72h) ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="text-sm font-black text-white/90">72-hour plan</div>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-white/80">
                {data.plan72h.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
