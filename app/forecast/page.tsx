"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** =============================
 *  Types (match your storage)
============================= */
type BucketKey = string;

type Bucket = {
  key: BucketKey;
  name: string;
  target: number;
  saved: number;
  dueDate?: string;
  due?: string;
  priority: 1 | 2 | 3;
  focus?: boolean;

  balance?: number;
  apr?: number;

  isMonthly?: boolean;
  monthlyTarget?: number;
  dueDay?: number;
};

type Entry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

type StorageShape = {
  buckets: Bucket[];
  entries: Entry[];
  meta?: { lastMonthlyApplied?: string };
};

// ⚠️ MUST MATCH your /money page
const STORAGE_KEY = "money-control-board-v4";

/** =============================
 *  Helpers
============================= */
function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * 100) / 100;
  return Math.max(0, v);
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(iso: string) {
  // Monday start
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun..6 Sat
  const mondayOffset = (day + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(iso: string) {
  return addDaysISO(startOfWeekISO(iso), 6);
}

function inRangeISO(d: string, start: string, end: string) {
  return d >= start && d <= end;
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function quarterKey(iso: string) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)); // 1-12
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

/** =============================
 *  Small UI bits
============================= */
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      <div className="text-xs font-extrabold tracking-wide text-white/70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {sub ? <div className="mt-2 text-xs text-white/65">{sub}</div> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
      <span className="text-xs font-semibold text-white/75">{label}</span>
      <input
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[120px] rounded-lg border border-white/12 bg-black/40 px-2 py-1 text-right text-sm font-bold text-white outline-none"
      />
    </label>
  );
}

/** =============================
 *  Page
============================= */
export default function ForecastPage() {
  const now = todayISO();

  const [loaded, setLoaded] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  // baseline
  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  // Hustle assumptions
  const [spatialyticsPerJob, setSpatialyticsPerJob] = useState<number>(500);
  const [spatialyticsJobsPerWeek, setSpatialyticsJobsPerWeek] = useState<number>(1);

  const [gritProfitPerSale, setGritProfitPerSale] = useState<number>(12);
  const [gritSalesPerWeek, setGritSalesPerWeek] = useState<number>(10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw) as StorageShape;
      setBuckets(parsed.buckets || []);
      setEntries(parsed.entries || []);
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  const forecast = useMemo(() => {
    const w1Start = startOfWeekISO(now);

    const weeks = Array.from({ length: 13 }).map((_, i) => {
      const start = addDaysISO(w1Start, i * 7);
      const end = endOfWeekISO(start);
      return { i, start, end, label: `Week ${i + 1}`, range: `${start} → ${end}` };
    });

    const remainingForBucket = (b: Bucket) => {
      if ((b.target || 0) <= 0) return 0;
      return clampMoney(Math.max(0, (b.target || 0) - (b.saved || 0)));
    };

    const incomeInWeek = (start: string, end: string) =>
      clampMoney(
        entries
          .filter((e) => inRangeISO(e.dateISO, start, end))
          .reduce((s, e) => s + (e.amount || 0), 0)
      );

    const billsDueInWeek = (start: string, end: string) =>
      clampMoney(
        buckets
          .filter((b) => (b.dueDate || "").trim())
          .filter((b) => inRangeISO((b.dueDate || "").trim(), start, end))
          .reduce((s, b) => s + remainingForBucket(b), 0)
      );

    let carry = 0;

    const rows = weeks.map((w) => {
      const bills = billsDueInWeek(w.start, w.end);
      const income = incomeInWeek(w.start, w.end);

      const needTotal = clampMoney(bills + weeklyBaseline + carry);
      const stillNeed = clampMoney(Math.max(0, needTotal - income));

      carry = stillNeed;

      return {
        ...w,
        bills,
        income,
        baseline: weeklyBaseline,
        needTotal,
        stillNeed,
      };
    });

    const thisMonth = monthKey(now);
    const thisQuarter = quarterKey(now);

    const monthTotalNeed = clampMoney(
      rows.filter((r) => monthKey(r.start) === thisMonth).reduce((s, r) => s + r.stillNeed, 0)
    );

    const quarterTotalNeed = clampMoney(
      rows.filter((r) => quarterKey(r.start) === thisQuarter).reduce((s, r) => s + r.stillNeed, 0)
    );

    const spatialyticsWeekly = clampMoney(spatialyticsPerJob * spatialyticsJobsPerWeek);
    const gritWeekly = clampMoney(gritProfitPerSale * gritSalesPerWeek);
    const hustleWeekly = clampMoney(spatialyticsWeekly + gritWeekly);

    const week1Gap = rows[0]?.stillNeed || 0;
    const remainingAfterHustle = clampMoney(Math.max(0, week1Gap - hustleWeekly));

    const moreGritSalesNeeded =
      gritProfitPerSale > 0 ? Math.ceil(remainingAfterHustle / gritProfitPerSale) : 0;

    const moreSpatialyticsJobsNeeded =
      spatialyticsPerJob > 0 ? Math.ceil(remainingAfterHustle / spatialyticsPerJob) : 0;

    return {
      rows,
      thisMonth,
      thisQuarter,
      monthTotalNeed,
      quarterTotalNeed,
      hustle: {
        spatialyticsWeekly,
        gritWeekly,
        hustleWeekly,
        week1Gap,
        remainingAfterHustle,
        moreGritSalesNeeded,
        moreSpatialyticsJobsNeeded,
      },
    };
  }, [
    buckets,
    entries,
    now,
    weeklyBaseline,
    spatialyticsPerJob,
    spatialyticsJobsPerWeek,
    gritProfitPerSale,
    gritSalesPerWeek,
  ]);

  if (!loaded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 text-white/80">
        Loading forecast…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-5 text-white">
      {/* Header */}
      <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="text-2xl font-black tracking-tight">Forecast</div>
        <div className="mt-1 text-sm text-white/70">
          Week-to-week carryover + monthly/quarter totals + hustle planner.
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/money"
            className="inline-flex items-center rounded-xl border border-white/12 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/14"
          >
            ← Back to Board
          </Link>

          <div className="ml-auto w-full sm:w-auto">
            <div className="text-xs font-extrabold text-white/70">Weekly baseline</div>
            <div className="mt-1 text-xs text-white/60">Gas / food / basics</div>
            <input
              inputMode="decimal"
              value={String(weeklyBaseline)}
              onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
              className="mt-2 w-full sm:w-[220px] rounded-xl border border-white/12 bg-black/35 px-3 py-2 text-sm font-bold text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`Still needed this month (${forecast.thisMonth})`}
          value={fmt(forecast.monthTotalNeed)}
        />
        <StatCard
          label={`Still needed this quarter (${forecast.thisQuarter})`}
          value={fmt(forecast.quarterTotalNeed)}
        />
        <StatCard
          label="Week 1 still needed"
          value={fmt(forecast.hustle.week1Gap)}
          sub="This already includes carryover logic."
        />
      </div>

      {/* Hustle planner */}
      <div className="mt-3 rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]">
        <div className="text-lg font-black">Hustle planner</div>
        <div className="mt-1 text-sm text-white/70">
          Quick “what would cover this week?” math.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-black text-white/90">Spatialytics</div>
            <div className="mt-3 grid gap-2">
              <Field label="Avg $ per job" value={spatialyticsPerJob} onChange={setSpatialyticsPerJob} />
              <Field label="Jobs per week" value={spatialyticsJobsPerWeek} onChange={setSpatialyticsJobsPerWeek} />
            </div>
            <div className="mt-3 text-sm text-white/75">
              Weekly from Spatialytics:{" "}
              <span className="font-black text-white">{fmt(forecast.hustle.spatialyticsWeekly)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-black text-white/90">Grit &amp; Grace</div>
            <div className="mt-3 grid gap-2">
              <Field label="Profit per sale" value={gritProfitPerSale} onChange={setGritProfitPerSale} />
              <Field label="Sales per week" value={gritSalesPerWeek} onChange={setGritSalesPerWeek} />
            </div>
            <div className="mt-3 text-sm text-white/75">
              Weekly from G&amp;G:{" "}
              <span className="font-black text-white">{fmt(forecast.hustle.gritWeekly)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-black text-white/90">Gap coverage</div>

            <div className="mt-3 text-xs font-semibold text-white/70">Combined hustle this week</div>
            <div className="mt-1 text-2xl font-black">{fmt(forecast.hustle.hustleWeekly)}</div>

            <div className="mt-3 text-xs font-semibold text-white/70">Remaining after hustle (Week 1)</div>
            <div className="mt-1 text-xl font-black">{fmt(forecast.hustle.remainingAfterHustle)}</div>

            <div className="mt-3 text-xs text-white/70">
              If you wanted to cover the rest with only:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>G&amp;G: ~{forecast.hustle.moreGritSalesNeeded} more sales</li>
                <li>Spatialytics: ~{forecast.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Week list */}
      <div className="mt-4 text-lg font-black">13-week carryover</div>
      <div className="mt-2 grid gap-3">
        {forecast.rows.map((r) => (
          <details
            key={r.start}
            className="group rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-black text-white/90">
                  {r.label} <span className="font-semibold text-white/60">({r.range})</span>
                </div>
                <div className="text-sm font-black">
                  Still need: <span className="text-white">{fmt(r.stillNeed)}</span>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/70 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="font-extrabold">Bills due</div>
                  <div className="mt-1 text-sm font-black text-white">{fmt(r.bills)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="font-extrabold">Baseline</div>
                  <div className="mt-1 text-sm font-black text-white">{fmt(r.baseline)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="font-extrabold">Income logged</div>
                  <div className="mt-1 text-sm font-black text-white">{fmt(r.income)}</div>
                </div>
              </div>

              <div className="mt-2 text-xs text-white/55">
                Tap to expand details
                <span className="ml-2 inline-block transition group-open:rotate-180">▾</span>
              </div>
            </summary>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs font-extrabold text-white/70">Total need this week (incl carryover)</div>
              <div className="mt-1 text-xl font-black text-white">{fmt(r.needTotal)}</div>
              <div className="mt-2 text-xs text-white/60">
                This is: bills due + baseline + whatever was still needed from last week.
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="mt-4 pb-8 text-xs text-white/60">
        Uses your current bucket “remaining” (target - saved) and logged income entries. Next step is
        adding real expenses and/or recurring monthly schedules.
      </div>
    </div>
  );
}
