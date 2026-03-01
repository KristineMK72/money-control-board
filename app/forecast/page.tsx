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
  return v;
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
   UI bits
============================= */

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{title}</div>
      <div className={styles.cardValue}>{value}</div>
      {hint ? <div className={styles.cardHint}>{hint}</div> : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.mini}>
      <div className={styles.miniLabel}>{label}</div>
      <div className={styles.miniValue}>{value}</div>
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

  // “not strapped” baseline (per week)
  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  // Hustle assumptions
  const [spatialyticsPerJob, setSpatialyticsPerJob] = useState<number>(500);
  const [spatialyticsJobsPerWeek, setSpatialyticsJobsPerWeek] = useState<number>(1);

  // PROFIT per sale (not revenue)
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

    // Carryover week-to-week (this part is fine)
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

    // ✅ FIXED totals:
    // Month/Quarter should NOT sum "stillNeed" (it includes carryover repeatedly).
    // Instead: baseline + bills - income within the month/quarter (clamped at >= 0).
    const thisMonth = monthKey(now);
    const thisQuarter = quarterKey(now);

    const monthRows = rows.filter((r) => monthKey(r.start) === thisMonth);
    const quarterRows = rows.filter((r) => quarterKey(r.start) === thisQuarter);

    const sum = (arr: number[]) => clampMoney(arr.reduce((a, b) => a + b, 0));

    const monthWeeks = monthRows.length;
    const quarterWeeks = quarterRows.length;

    const monthBaselineTotal = clampMoney(monthWeeks * weeklyBaseline);
    const quarterBaselineTotal = clampMoney(quarterWeeks * weeklyBaseline);

    const monthBills = sum(monthRows.map((r) => r.bills));
    const quarterBills = sum(quarterRows.map((r) => r.bills));

    const monthIncome = sum(monthRows.map((r) => r.income));
    const quarterIncome = sum(quarterRows.map((r) => r.income));

    const monthNeed = clampMoney(Math.max(0, monthBaselineTotal + monthBills - monthIncome));
    const quarterNeed = clampMoney(Math.max(0, quarterBaselineTotal + quarterBills - quarterIncome));

    // Hustle math (weekly)
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
      totals: {
        monthNeed,
        quarterNeed,
        monthBaselineTotal,
        monthBills,
        monthIncome,
        quarterBaselineTotal,
        quarterBills,
        quarterIncome,
        monthWeeks,
        quarterWeeks,
      },
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
    return <div className={styles.loading}>Loading forecast…</div>;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.h1}>Forecast</div>
          <div className={styles.sub}>
            Week-to-week carryover + realistic month/quarter totals + hustle planner.
          </div>

          <div className={styles.headerLinks}>
            <Link href="/money" className={styles.linkBtn}>
              ← Back to Board
            </Link>
          </div>
        </div>

        <div className={styles.cardMini}>
          <div className={styles.miniTop}>Weekly baseline</div>
          <div className={styles.miniSub}>Gas / food / basics</div>
          <input
            inputMode="decimal"
            value={String(weeklyBaseline)}
            onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
            className={styles.input}
          />
        </div>
      </header>

      <div className={styles.grid3}>
        <Card
          title={`Needed this month (${forecast.thisMonth})`}
          value={fmt(forecast.totals.monthNeed)}
          hint={`(${forecast.totals.monthWeeks} wks) Baseline ${fmt(
            forecast.totals.monthBaselineTotal
          )} + Bills ${fmt(forecast.totals.monthBills)} − Income ${fmt(forecast.totals.monthIncome)}`}
        />
        <Card
          title={`Needed this quarter (${forecast.thisQuarter})`}
          value={fmt(forecast.totals.quarterNeed)}
          hint={`(${forecast.totals.quarterWeeks} wks) Baseline ${fmt(
            forecast.totals.quarterBaselineTotal
          )} + Bills ${fmt(forecast.totals.quarterBills)} − Income ${fmt(forecast.totals.quarterIncome)}`}
        />
        <Card
          title="Week 1 gap (carryover view)"
          value={fmt(forecast.hustle.week1Gap)}
          hint="This is the running carryover model."
        />
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Hustle planner</div>
        <div className={styles.noteTop}>Quick “what would cover this week?” math.</div>

        <div className={styles.hustleGrid}>
          <div className={styles.cardInner}>
            <div className={styles.blockTitle}>Spatialytics</div>

            <div className={styles.formRow}>
              <span className={styles.label}>Avg $ per job</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsPerJob)}
                onChange={(e) => setSpatialyticsPerJob(Number(e.target.value))}
                className={styles.inputSm}
              />
            </div>

            <div className={styles.formRow}>
              <span className={styles.label}>Jobs / week</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsJobsPerWeek)}
                onChange={(e) => setSpatialyticsJobsPerWeek(Number(e.target.value))}
                className={styles.inputSm}
              />
            </div>

            <div className={styles.bigLine}>
              Weekly from Spatialytics:{" "}
              <span className={styles.strong}>{fmt(forecast.hustle.spatialyticsWeekly)}</span>
            </div>
          </div>

          <div className={styles.cardInner}>
            <div className={styles.blockTitle}>Grit &amp; Grace</div>

            <div className={styles.formRow}>
              <span className={styles.label}>Profit per sale</span>
              <input
                inputMode="decimal"
                value={String(gritProfitPerSale)}
                onChange={(e) => setGritProfitPerSale(Number(e.target.value))}
                className={styles.inputSm}
              />
            </div>

            <div className={styles.formRow}>
              <span className={styles.label}>Sales / week</span>
              <input
                inputMode="decimal"
                value={String(gritSalesPerWeek)}
                onChange={(e) => setGritSalesPerWeek(Number(e.target.value))}
                className={styles.inputSm}
              />
            </div>

            <div className={styles.bigLine}>
              Weekly from G&amp;G:{" "}
              <span className={styles.strong}>{fmt(forecast.hustle.gritWeekly)}</span>
            </div>
          </div>

          <div className={styles.cardInner}>
            <div className={styles.blockTitle}>Gap coverage</div>

            <div className={styles.labelMuted}>Combined hustle this week</div>
            <div className={styles.bigNumber}>{fmt(forecast.hustle.hustleWeekly)}</div>

            <div className={styles.labelMuted} style={{ marginTop: 10 }}>
              Remaining after hustle (Week 1)
            </div>
            <div className={styles.bigNumberSm}>
              {fmt(forecast.hustle.remainingAfterHustle)}
            </div>

            <div className={styles.note}>
              If you wanted to cover the rest with only:
              <ul className={styles.ul}>
                <li>G&amp;G: ~{forecast.hustle.moreGritSalesNeeded} more sales</li>
                <li>Spatialytics: ~{forecast.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 14 }}>
        13-week carryover forecast
      </div>
      <div className={styles.noteTop}>
        This is the “running carryover” view (useful for pacing), but it’s not the same as monthly totals.
      </div>

      <div className={styles.list}>
        {forecast.rows.map((r) => (
          <div key={r.start} className={styles.card}>
            <div className={styles.rowTop}>
              <div className={styles.rowTitle}>{r.label}</div>
              <div className={styles.rowTitle}>Still need: {fmt(r.stillNeed)}</div>
            </div>

            <div className={styles.grid4}>
              <Mini label="Bills due" value={fmt(r.bills)} />
              <Mini label="Baseline" value={fmt(r.baseline)} />
              <Mini label="Income logged" value={fmt(r.income)} />
              <Mini label="Total need" value={fmt(r.needTotal)} />
            </div>
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        Month/Quarter totals are: baseline + bills − income (no double-counting carryover).
        Carryover list is a pacing model that assumes “uncovered need” rolls forward week to week.
      </footer>
    </div>
  );
}

/* =============================
   STYLES (dark glass)
============================= */

const styles = {
  shell: "mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white",
  loading: "mx-auto w-full max-w-3xl px-4 pb-28 pt-6 text-white/80",

  header:
    "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between",
  headerLeft: "min-w-0",
  h1: "text-4xl font-black tracking-tight",
  sub: "mt-2 text-sm text-white/70 max-w-[32rem]",
  headerLinks: "mt-4 flex flex-wrap gap-2",
  linkBtn:
    "inline-flex items-center rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/14 active:scale-[0.99] transition",

  grid3: "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3",
  grid4: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4",
  list: "mt-3 grid gap-3",

  card:
    "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]",
  cardMini:
    "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]",
  cardInner:
    "rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl",

  cardTitle: "text-xs font-extrabold text-white/70",
  cardValue: "mt-2 text-3xl font-black",
  cardHint: "mt-3 text-xs text-white/65 leading-relaxed",

  mini: "rounded-2xl border border-white/10 bg-black/20 p-3",
  miniLabel: "text-[11px] font-extrabold text-white/70",
  miniValue: "mt-1 text-sm font-black text-white/90",

  sectionTitle: "text-xl font-black",
  noteTop: "mt-2 text-xs text-white/60 leading-relaxed",

  blockTitle: "text-sm font-black text-white/90",
  label: "text-xs font-semibold text-white/75",
  labelMuted: "text-xs font-semibold text-white/70",
  strong: "font-black text-white/95",

  hustleGrid: "mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3",
  formRow: "mt-3 flex items-center justify-between gap-3",

  // ✅ these fix your TS error + improve readability
  miniTop: "text-sm font-black text-white/90",
  miniSub: "mt-1 text-xs text-white/65",

  input:
    "mt-3 w-full max-w-[240px] rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40",
  inputSm:
    "w-[130px] rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 text-right",

  bigLine: "mt-4 text-sm text-white/80",
  bigNumber: "mt-2 text-3xl font-black",
  bigNumberSm: "mt-2 text-2xl font-black",

  note: "mt-4 text-xs text-white/70 leading-relaxed",
  ul: "mt-2 list-disc pl-5 space-y-1",

  rowTop: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
  rowTitle: "text-sm font-black text-white/90",

  footer: "mt-4 pb-10 text-xs text-white/55 leading-relaxed",
} as const;
