"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useMoneyStore } from "@/lib/money/store";
import { fmt } from "@/lib/money/utils";

/* =============================
   Date helpers
============================= */

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
  const m = Number(iso.slice(5, 7));
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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

  // ✅ LIVE: pull directly from Zustand store
  const store = useMoneyStore();
  const buckets = store.buckets;
  const entries = store.entries;

  // baseline per week
  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  // hustle assumptions
  const [spatialyticsPerJob, setSpatialyticsPerJob] = useState<number>(500);
  const [spatialyticsJobsPerWeek, setSpatialyticsJobsPerWeek] = useState<number>(1);
  const [gritProfitPerSale, setGritProfitPerSale] = useState<number>(12);
  const [gritSalesPerWeek, setGritSalesPerWeek] = useState<number>(10);

  const forecast = useMemo(() => {
    const w1Start = startOfWeekISO(now);

    const weeks = Array.from({ length: 13 }).map((_, i) => {
      const start = addDaysISO(w1Start, i * 7);
      const end = endOfWeekISO(start);
      return { i, start, end, label: `Week ${i + 1} (${start} → ${end})` };
    });

    const remainingForBucket = (b: any) => {
      const target = Number(b.target || 0);
      const saved = Number(b.saved || 0);
      if (target <= 0) return 0;
      return clampMoney(Math.max(0, target - saved));
    };

    const incomeInWeek = (start: string, end: string) =>
      clampMoney(
        entries
          .filter((e: any) => inRangeISO(e.dateISO, start, end))
          .reduce((s: number, e: any) => s + (e.amount || 0), 0)
      );

    const billsDueInWeek = (start: string, end: string) =>
      clampMoney(
        buckets
          .filter((b: any) => (b.dueDate || "").trim())
          .filter((b: any) => inRangeISO((b.dueDate || "").trim(), start, end))
          .reduce((s: number, b: any) => s + remainingForBucket(b), 0)
      );

    // Carryover pacing: week-to-week gap rolls forward
    let carry = 0;
    const rows = weeks.map((w) => {
      const bills = billsDueInWeek(w.start, w.end);
      const income = incomeInWeek(w.start, w.end);

      const needTotal = clampMoney(bills + weeklyBaseline + carry);
      const stillNeed = clampMoney(Math.max(0, needTotal - income));
      carry = stillNeed;

      return { ...w, bills, income, baseline: weeklyBaseline, needTotal, stillNeed };
    });

    // Month/quarter totals should NOT sum stillNeed (double-counts carry)
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

    // Hustle
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
        monthWeeks,
        quarterWeeks,
        monthBaselineTotal,
        quarterBaselineTotal,
        monthBills,
        quarterBills,
        monthIncome,
        quarterIncome,
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

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div>
          <div className={styles.h1}>Forecast</div>
          <div className={styles.sub}>
            Carryover pacing (week-to-week) + realistic month/quarter totals + hustle planner.
          </div>
          <div className={styles.heroLinks}>
            <Link href="/money" className={styles.linkBtn}>
              ← Back to Board
            </Link>
          </div>
        </div>

        <div className={styles.miniCard}>
          <div className={styles.miniTop}>Weekly baseline</div>
          <div className={styles.miniSub}>Gas / food / basics</div>
          <input
            inputMode="decimal"
            value={String(weeklyBaseline)}
            onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
            className={styles.input}
          />
        </div>
      </div>

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
          title="Week 1 gap (carryover)"
          value={fmt(forecast.hustle.week1Gap)}
          hint="This is the pacing model: unpaid need rolls forward."
        />
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Hustle planner</div>
        <div className={styles.noteTop}>Quick “what would cover this week?” math.</div>

        <div className={styles.hustleGrid}>
          <div className={styles.innerCard}>
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

          <div className={styles.innerCard}>
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

          <div className={styles.innerCard}>
            <div className={styles.blockTitle}>Gap coverage</div>

            <div className={styles.labelMuted}>Combined hustle this week</div>
            <div className={styles.bigNumber}>{fmt(forecast.hustle.hustleWeekly)}</div>

            <div className={styles.labelMuted} style={{ marginTop: 10 }}>
              Remaining after hustle (Week 1)
            </div>
            <div className={styles.bigNumberSm}>{fmt(forecast.hustle.remainingAfterHustle)}</div>

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
        13-week carryover pacing
      </div>
      <div className={styles.noteTop}>Tap a week to expand (keeps it readable).</div>

      <div className={styles.list}>
        {forecast.rows.map((r) => (
          <details key={r.start} className={styles.details}>
            <summary className={styles.summary}>
              <span className={styles.summaryLeft}>{r.label}</span>
              <span className={styles.summaryRight}>{fmt(r.stillNeed)}</span>
            </summary>

            <div className={styles.grid4}>
              <Mini label="Bills due" value={fmt(r.bills)} />
              <Mini label="Baseline" value={fmt(r.baseline)} />
              <Mini label="Income logged" value={fmt(r.income)} />
              <Mini label="Total need" value={fmt(r.needTotal)} />
            </div>
          </details>
        ))}
      </div>

      <footer className={styles.footer}>
        Month/Quarter totals are: baseline + bills − income (no double-counting carryover). Carryover pacing assumes “uncovered need” rolls forward week to week.
      </footer>
    </div>
  );
}

/* =============================
   STYLES
============================= */

const styles = {
  shell:
    "mx-auto w-full max-w-3xl px-4 pb-28 pt-4 text-white font-sans antialiased",
  hero:
    "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between",
  h1: "text-4xl font-black tracking-tight",
  sub: "mt-2 text-sm text-white/70 max-w-[34rem]",
  heroLinks: "mt-4 flex flex-wrap gap-2",
  linkBtn:
    "inline-flex items-center rounded-2xl border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/14 active:scale-[0.99] transition",

  miniCard:
    "rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl min-w-[240px]",
  miniTop: "text-sm font-black text-white/90",
  miniSub: "mt-1 text-xs text-white/65",

  grid3: "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3",
  grid4: "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4",
  list: "mt-3 grid gap-3",

  card:
    "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)]",
  innerCard:
    "rounded-3xl border border-white/10 bg-black/20 p-4 backdrop-blur-xl",

  cardTitle: "text-xs font-extrabold text-white/70",
  cardValue: "mt-2 text-3xl font-black",
  cardHint: "mt-3 text-xs text-white/65 leading-relaxed",

  sectionTitle: "text-xl font-black",
  noteTop: "mt-2 text-xs text-white/60 leading-relaxed",

  blockTitle: "text-sm font-black text-white/90",
  label: "text-xs font-semibold text-white/75",
  labelMuted: "text-xs font-semibold text-white/70",
  strong: "font-black text-white/95",

  hustleGrid: "mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3",
  formRow: "mt-3 flex items-center justify-between gap-3",

  input:
    "mt-3 w-full max-w-[240px] rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40",
  inputSm:
    "w-[130px] rounded-2xl border border-white/12 bg-black/35 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 text-right",

  bigLine: "mt-4 text-sm text-white/80",
  bigNumber: "mt-2 text-3xl font-black",
  bigNumberSm: "mt-2 text-2xl font-black",

  note: "mt-4 text-xs text-white/70 leading-relaxed",
  ul: "mt-2 list-disc pl-5 space-y-1",

  details:
    "rounded-3xl border border-white/10 bg-white/5 p-0 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)] overflow-hidden",
  summary:
    "cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3",
  summaryLeft: "text-sm font-black text-white/90",
  summaryRight: "text-sm font-black text-white/90",

  mini: "rounded-2xl border border-white/10 bg-black/20 p-3 m-4 mt-0",
  miniLabel: "text-[11px] font-extrabold text-white/70",
  miniValue: "mt-1 text-sm font-black text-white/90",

  footer: "mt-4 pb-10 text-xs text-white/55 leading-relaxed",
} as const;
