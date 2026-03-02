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

const STORAGE_KEY = "money-control-board-v4";

/* =============================
   HELPERS
============================= */

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statRow}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
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

  // Weekly baseline
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

    // ✅ Bills split into:
    // 1) dueThisWeek: dueDate within week
    // 2) overdueCarry: dueDate before week start AND still remaining
    const dueThisWeek = (start: string, end: string) =>
      clampMoney(
        buckets
          .filter((b) => (b.dueDate || "").trim())
          .filter((b) => inRangeISO((b.dueDate || "").trim(), start, end))
          .reduce((s, b) => s + remainingForBucket(b), 0)
      );

    const overdueCarry = (start: string) =>
      clampMoney(
        buckets
          .filter((b) => (b.dueDate || "").trim())
          .filter((b) => (b.dueDate || "").trim() < start)
          .reduce((s, b) => s + remainingForBucket(b), 0)
      );

    // Carryover model: unmet need rolls forward
    let carry = 0;

    const rows = weeks.map((w) => {
      const income = incomeInWeek(w.start, w.end);
      const billsDue = dueThisWeek(w.start, w.end);
      const billsOverdue = overdueCarry(w.start);

      // Total bills shown this week = overdue still remaining + this week's due bills
      // (This matches “it stays on the list until you fund it.”)
      const billsTotal = clampMoney(billsOverdue + billsDue);

      const needTotal = clampMoney(billsTotal + weeklyBaseline + carry);
      const stillNeed = clampMoney(Math.max(0, needTotal - income));
      carry = stillNeed;

      return {
        ...w,
        income,
        billsDue,
        billsOverdue,
        billsTotal,
        baseline: weeklyBaseline,
        needTotal,
        stillNeed,
      };
    });

    // ✅ FIXED month/quarter totals:
    // baseline + bills - income (no summing "stillNeed")
    const thisMonth = monthKey(now);
    const thisQuarter = quarterKey(now);

    const monthRows = rows.filter((r) => monthKey(r.start) === thisMonth);
    const quarterRows = rows.filter((r) => quarterKey(r.start) === thisQuarter);

    const sum = (arr: number[]) => clampMoney(arr.reduce((a, b) => a + b, 0));

    const monthWeeks = monthRows.length;
    const quarterWeeks = quarterRows.length;

    const monthBaselineTotal = clampMoney(monthWeeks * weeklyBaseline);
    const quarterBaselineTotal = clampMoney(quarterWeeks * weeklyBaseline);

    // For totals, use billsDue + overdue at the START of each week would double count overdue.
    // So totals should use ONLY bills that are actually due inside that month/quarter,
    // plus baseline, minus income. (Overdue is already "you missed it"; it belongs in carryover pacing.)
    const billsDueInRows = (rs: typeof rows) => sum(rs.map((r) => r.billsDue));

    const monthBillsDue = billsDueInRows(monthRows);
    const quarterBillsDue = billsDueInRows(quarterRows);

    const monthIncome = sum(monthRows.map((r) => r.income));
    const quarterIncome = sum(quarterRows.map((r) => r.income));

    const monthNeed = clampMoney(Math.max(0, monthBaselineTotal + monthBillsDue - monthIncome));
    const quarterNeed = clampMoney(Math.max(0, quarterBaselineTotal + quarterBillsDue - quarterIncome));

    // Hustle math
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
        monthBillsDue,
        quarterBillsDue,
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

  if (!loaded) return <div className={styles.loading}>Loading forecast…</div>;

  return (
    <div className={styles.shell}>
      <div className={styles.hero}>
        <div>
          <div className={styles.h1}>Forecast</div>
          <div className={styles.sub}>
            Week-to-week carryover pacing + realistic month/quarter totals + hustle planner.
          </div>
          <div className={styles.headerLinks}>
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
          )} + Bills due ${fmt(forecast.totals.monthBillsDue)} − Income ${fmt(
            forecast.totals.monthIncome
          )}`}
        />
        <Card
          title={`Needed this quarter (${forecast.thisQuarter})`}
          value={fmt(forecast.totals.quarterNeed)}
          hint={`(${forecast.totals.quarterWeeks} wks) Baseline ${fmt(
            forecast.totals.quarterBaselineTotal
          )} + Bills due ${fmt(forecast.totals.quarterBillsDue)} − Income ${fmt(
            forecast.totals.quarterIncome
          )}`}
        />
        <Card
          title="Week 1 gap (carryover view)"
          value={fmt(forecast.hustle.week1Gap)}
          hint="This includes overdue carry + baseline + carryover, minus logged income."
        />
      </div>

      <div className={styles.card}>
        <div className={styles.sectionTitle}>Hustle planner</div>
        <div className={styles.noteTop}>Mobile-friendly inputs (they stack).</div>

        <div className={styles.hustleGrid}>
          <div className={styles.inner}>
            <div className={styles.blockTitle}>Spatialytics</div>

            <label className={styles.field}>
              <span>Avg $ per job</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsPerJob)}
                onChange={(e) => setSpatialyticsPerJob(Number(e.target.value))}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span>Jobs / week</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsJobsPerWeek)}
                onChange={(e) => setSpatialyticsJobsPerWeek(Number(e.target.value))}
                className={styles.input}
              />
            </label>

            <div className={styles.bigLine}>
              Weekly from Spatialytics:{" "}
              <span className={styles.strong}>{fmt(forecast.hustle.spatialyticsWeekly)}</span>
            </div>
          </div>

          <div className={styles.inner}>
            <div className={styles.blockTitle}>Grit &amp; Grace</div>

            <label className={styles.field}>
              <span>Profit per sale</span>
              <input
                inputMode="decimal"
                value={String(gritProfitPerSale)}
                onChange={(e) => setGritProfitPerSale(Number(e.target.value))}
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span>Sales / week</span>
              <input
                inputMode="decimal"
                value={String(gritSalesPerWeek)}
                onChange={(e) => setGritSalesPerWeek(Number(e.target.value))}
                className={styles.input}
              />
            </label>

            <div className={styles.bigLine}>
              Weekly from G&amp;G:{" "}
              <span className={styles.strong}>{fmt(forecast.hustle.gritWeekly)}</span>
            </div>
          </div>

          <div className={styles.inner}>
            <div className={styles.blockTitle}>Gap coverage</div>

            <div className={styles.labelMuted}>Combined hustle this week</div>
            <div className={styles.bigNumber}>{fmt(forecast.hustle.hustleWeekly)}</div>

            <div className={styles.labelMuted} style={{ marginTop: 10 }}>
              Remaining after hustle (Week 1)
            </div>
            <div className={styles.bigNumberSm}>{fmt(forecast.hustle.remainingAfterHustle)}</div>

            <div className={styles.note}>
              Cover the rest with only:
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
      <div className={styles.noteTop}>Tap a week to open details (keeps it readable).</div>

      <div className={styles.list}>
        {forecast.rows.map((r) => (
          <details key={r.start} className={styles.details}>
            <summary className={styles.summary}>
              <div className={styles.summaryLeft}>
                <div className={styles.weekTitle}>{r.label}</div>
                <div className={styles.weekSub}>
                  Due {fmt(r.billsDue)} · Overdue {fmt(r.billsOverdue)} · Income {fmt(r.income)}
                </div>
              </div>
              <div className={styles.weekNeed}>{fmt(r.stillNeed)}</div>
            </summary>

            <div className={styles.detailsBody}>
