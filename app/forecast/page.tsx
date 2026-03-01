"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

/* =============================
   HELPERS
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

/* =============================
   UI
============================= */

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-xl">
      <div className="text-[11px] font-extrabold text-white/70">{title}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs text-white/65">{hint}</div> : null}
    </div>
  );
}

function Mini({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/12 bg-black/40 p-3">
      <div className="text-[11px] font-extrabold text-white/70">{label}</div>
      <div className="mt-1 text-sm font-black text-white/90">{value}</div>
    </div>
  );
}

/* =============================
   PAGE
============================= */

export default function ForecastPage() {
  const now = todayISO();

  const [loaded, setLoaded] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  // Hustle assumptions
  const [spatialyticsPerJob, setSpatialyticsPerJob] = useState<number>(500);
  const [spatialyticsJobsPerWeek, setSpatialyticsJobsPerWeek] = useState<number>(1);

  // Profit assumptions
  const [gritProfitPerSale, setGritProfitPerSale] = useState<number>(12);
  const [gritSalesPerWeek, setGritSalesPerWeek] = useState<number>(10);

  // Mobile UX: collapse/expand weekly rows
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

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
      return { i, start, end, label: `Week ${i + 1} (${start} → ${end})` };
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
      rows
        .filter((r) => monthKey(r.start) === thisMonth)
        .reduce((s, r) => s + r.stillNeed, 0)
    );

    const quarterTotalNeed = clampMoney(
      rows
        .filter((r) => quarterKey(r.start) === thisQuarter)
        .reduce((s, r) => s + r.stillNeed, 0)
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
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 text-white/80">
        Loading forecast…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white">
      {/* Header */}
      <div className="rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-black tracking-tight">Forecast</div>
            <div className="mt-1 text-sm text-white/70">
              Carryover week-to-week + month/quarter totals + hustle planner.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/money"
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 active:scale-[0.99] transition"
              >
                ← Back to Board
              </Link>
            </div>
          </div>

          <div className="w-full max-w-xs rounded-2xl border border-white/12 bg-black/40 p-4">
            <div className="text-sm font-black text-white/90">Weekly baseline</div>
            <div className="mt-1 text-xs text-white/70">Gas/food/basics (until we add real expenses)</div>
            <input
              inputMode="decimal"
              value={String(weeklyBaseline)}
              onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
              className="mt-3 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title={`Still Needed This Month (${forecast.thisMonth})`}
          value={fmt(forecast.monthTotalNeed)}
        />
        <StatCard
          title={`Still Needed This Quarter (${forecast.thisQuarter})`}
          value={fmt(forecast.quarterTotalNeed)}
        />
        <StatCard
          title="Week 1 Still Needed"
          value={fmt(forecast.hustle.week1Gap)}
          hint="Includes carryover logic."
        />
      </div>

      {/* Hustle planner */}
      <div className="mt-3 rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-xl">
        <div className="text-lg font-black">Hustle Planner</div>
        <div className="mt-1 text-sm text-white/70">Simple math to cover the Week 1 gap.</div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Spatialytics */}
          <div className="rounded-2xl border border-white/12 bg-black/40 p-4">
            <div className="text-sm font-black text-white/90">Spatialytics</div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/75">Avg $ per job</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsPerJob)}
                onChange={(e) => setSpatialyticsPerJob(Number(e.target.value))}
                className="w-[130px] rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none text-right"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/75">Jobs / week</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsJobsPerWeek)}
                onChange={(e) => setSpatialyticsJobsPerWeek(Number(e.target.value))}
                className="w-[130px] rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none text-right"
              />
            </div>

            <div className="mt-3 text-sm text-white/80">
              Weekly from Spatialytics:{" "}
              <span className="font-black text-white/95">{fmt(forecast.hustle.spatialyticsWeekly)}</span>
            </div>
          </div>

          {/* Grit & Grace */}
          <div className="rounded-2xl border border-white/12 bg-black/40 p-4">
            <div className="text-sm font-black text-white/90">Grit &amp; Grace</div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/75">Profit per sale</span>
              <input
                inputMode="decimal"
                value={String(gritProfitPerSale)}
                onChange={(e) => setGritProfitPerSale(Number(e.target.value))}
                className="w-[130px] rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none text-right"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/75">Sales / week</span>
              <input
                inputMode="decimal"
                value={String(gritSalesPerWeek)}
                onChange={(e) => setGritSalesPerWeek(Number(e.target.value))}
                className="w-[130px] rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none text-right"
              />
            </div>

            <div className="mt-3 text-sm text-white/80">
              Weekly from Grit &amp; Grace:{" "}
              <span className="font-black text-white/95">{fmt(forecast.hustle.gritWeekly)}</span>
            </div>
          </div>

          {/* Coverage */}
          <div className="rounded-2xl border border-white/12 bg-black/40 p-4">
            <div className="text-sm font-black text-white/90">Gap Coverage</div>

            <div className="mt-3 text-xs font-semibold text-white/70">Combined hustle this week</div>
            <div className="mt-2 text-2xl font-black">{fmt(forecast.hustle.hustleWeekly)}</div>

            <div className="mt-3 text-xs font-semibold text-white/70">Remaining after hustle (Week 1)</div>
            <div className="mt-2 text-xl font-black">{fmt(forecast.hustle.remainingAfterHustle)}</div>

            <div className="mt-3 text-xs text-white/70">
              If you wanted to cover the rest with only:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Grit &amp; Grace: ~{forecast.hustle.moreGritSalesNeeded} more sales</li>
                <li>Spatialytics: ~{forecast.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly forecast */}
      <div className="mt-4 text-lg font-black">13-week carryover forecast</div>
      <div className="mt-2 grid gap-3">
        {forecast.rows.map((r) => {
          const open = !!openWeeks[r.start];
          return (
            <div key={r.start} className="rounded-2xl border border-white/15 bg-black/55 p-4 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setOpenWeeks((s) => ({ ...s, [r.start]: !s[r.start] }))}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-black text-white/90">{r.label}</div>
                  <div className="mt-1 text-xs text-white/65">
                    Bills {fmt(r.bills)} • Baseline {fmt(r.baseline)} • Income {fmt(r.income)}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-extrabold text-white/70">Still need</div>
                  <div className="mt-1 text-base font-black">{fmt(r.stillNeed)}</div>
                  <div className="mt-1 text-[11px] text-white/60">{open ? "Hide" : "Details"}</div>
                </div>
              </button>

              {open ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Mini label="Bills due (remaining)" value={fmt(r.bills)} />
                  <Mini label="Baseline" value={fmt(r.baseline)} />
                  <Mini label="Income logged" value={fmt(r.income)} />
                  <Mini label="Total need (incl carryover)" value={fmt(r.needTotal)} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pb-8 text-xs text-white/60">
        Note: This uses your current bucket “remaining” (target - saved) and your logged income entries.
        Next step is adding real expenses and/or recurring monthly schedules so the forecast becomes a true budget.
      </div>
    </div>
  );
}
