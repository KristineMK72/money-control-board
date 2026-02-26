"use client";

import React, { useEffect, useMemo, useState } from "react";

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

  // optional debt metadata (display only)
  balance?: number;
  apr?: number;

  // optional monthly behavior (if you already added this)
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
   PAGE
============================= */

export default function ForecastPage() {
  const now = todayISO();

  const [loaded, setLoaded] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  // “not strapped” baseline (set it here so this page is independent)
  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

  // Hustle assumptions
  const [spatialyticsPerJob, setSpatialyticsPerJob] = useState<number>(500);
  const [spatialyticsJobsPerWeek, setSpatialyticsJobsPerWeek] = useState<number>(1);

  // Use PROFIT per sale (not revenue) for sanity
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

    // Remaining due amounts (based on current bucket remaining: target - saved)
    const remainingForBucket = (b: Bucket) => {
      if ((b.target || 0) <= 0) return 0;
      return clampMoney(Math.max(0, (b.target || 0) - (b.saved || 0)));
    };

    // Income logged per week (based on entries)
    const incomeInWeek = (start: string, end: string) =>
      clampMoney(
        entries
          .filter((e) => inRangeISO(e.dateISO, start, end))
          .reduce((s, e) => s + (e.amount || 0), 0)
      );

    // Bills due per week (based on buckets’ dueDate that fall in that week)
    const billsDueInWeek = (start: string, end: string) =>
      clampMoney(
        buckets
          .filter((b) => (b.dueDate || "").trim())
          .filter((b) => inRangeISO((b.dueDate || "").trim(), start, end))
          .reduce((s, b) => s + remainingForBucket(b), 0)
      );

    // Build carryover logic week-to-week:
    // need = baseline + bills + carryoverPrev
    // stillNeed = max(0, need - incomeThisWeek)
    let carry = 0;

    const rows = weeks.map((w) => {
      const bills = billsDueInWeek(w.start, w.end);
      const income = incomeInWeek(w.start, w.end);

      const needTotal = clampMoney(bills + weeklyBaseline + carry);
      const stillNeed = clampMoney(Math.max(0, needTotal - income));

      // update carry for next week
      carry = stillNeed;

      return {
        ...w,
        bills,
        income,
        baseline: weeklyBaseline,
        carryIn: clampMoney(needTotal - bills - weeklyBaseline),
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

    // Hustle math (weekly)
    const spatialyticsWeekly = clampMoney(spatialyticsPerJob * spatialyticsJobsPerWeek);
    const gritWeekly = clampMoney(gritProfitPerSale * gritSalesPerWeek);
    const hustleWeekly = clampMoney(spatialyticsWeekly + gritWeekly);

    // How many more jobs/sales needed to cover Week 1 gap (simple)
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

  if (!loaded) return <div style={styles.shell}>Loading forecast…</div>;

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 950, marginBottom: 6 }}>Forecast</div>
          <div style={{ opacity: 0.8 }}>
            Carryover week-to-week + Month/Quarter totals + Hustle planner.
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/money" style={btnLink()}>
              ← Back to /money
            </a>
          </div>
        </div>

        <div style={styles.panelMini}>
          <div style={{ fontWeight: 950 }}>Weekly baseline</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
            Gas/food/basics (until we build real expenses)
          </div>
          <input
            inputMode="decimal"
            value={String(weeklyBaseline)}
            onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
            style={{ ...styles.input, marginTop: 10, width: 160 }}
          />
        </div>
      </header>

      <div style={styles.grid3}>
        <Card title={`Still Needed This Month (${forecast.thisMonth})`} value={fmt(forecast.monthTotalNeed)} />
        <Card title={`Still Needed This Quarter (${forecast.thisQuarter})`} value={fmt(forecast.quarterTotalNeed)} />
        <Card title="Week 1 Still Needed" value={fmt(forecast.hustle.week1Gap)} hint="This already includes carryover logic." />
      </div>

      <div style={styles.panel}>
        <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 10 }}>Hustle Planner (covers the gap)</div>

        <div style={styles.hustleGrid}>
          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Spatialytics</div>
            <div style={styles.row}>
              <span>Avg $ per job</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsPerJob)}
                onChange={(e) => setSpatialyticsPerJob(Number(e.target.value))}
                style={styles.input}
              />
            </div>
            <div style={styles.row}>
              <span>Jobs / week</span>
              <input
                inputMode="decimal"
                value={String(spatialyticsJobsPerWeek)}
                onChange={(e) => setSpatialyticsJobsPerWeek(Number(e.target.value))}
                style={styles.input}
              />
            </div>
            <div style={{ marginTop: 10, fontWeight: 950 }}>
              Weekly from Spatialytics: {fmt(forecast.hustle.spatialyticsWeekly)}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Grit & Grace</div>
            <div style={styles.row}>
              <span>Profit per sale</span>
              <input
                inputMode="decimal"
                value={String(gritProfitPerSale)}
                onChange={(e) => setGritProfitPerSale(Number(e.target.value))}
                style={styles.input}
              />
            </div>
            <div style={styles.row}>
              <span>Sales / week</span>
              <input
                inputMode="decimal"
                value={String(gritSalesPerWeek)}
                onChange={(e) => setGritSalesPerWeek(Number(e.target.value))}
                style={styles.input}
              />
            </div>
            <div style={{ marginTop: 10, fontWeight: 950 }}>
              Weekly from Grit & Grace: {fmt(forecast.hustle.gritWeekly)}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Gap Coverage</div>
            <div style={{ opacity: 0.85 }}>Combined hustle this week:</div>
            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>{fmt(forecast.hustle.hustleWeekly)}</div>

            <div style={{ marginTop: 10, opacity: 0.85 }}>Remaining after hustle (Week 1):</div>
            <div style={{ fontSize: 20, fontWeight: 950, marginTop: 6 }}>{fmt(forecast.hustle.remainingAfterHustle)}</div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              If you wanted to cover the rest with **only**:
              <ul style={{ marginTop: 6 }}>
                <li>Grit & Grace: ~{forecast.hustle.moreGritSalesNeeded} more sales</li>
                <li>Spatialytics: ~{forecast.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 18, fontWeight: 950 }}>13-week carryover forecast</div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {forecast.rows.map((r) => (
          <div key={r.start} style={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>{r.label}</div>
              <div style={{ fontWeight: 950 }}>Still need: {fmt(r.stillNeed)}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 10 }}>
              <Mini label="Bills due (remaining)" value={fmt(r.bills)} />
              <Mini label="Baseline" value={fmt(r.baseline)} />
              <Mini label="Income logged" value={fmt(r.income)} />
              <Mini label="Total need (incl carryover)" value={fmt(r.needTotal)} />
            </div>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: 18, opacity: 0.8, fontSize: 13 }}>
        Note: This uses your current bucket “remaining” (target - saved) and your logged income entries.
        Next step is to add real “expenses” and/or recurring monthly schedules so the forecast becomes a true budget.
      </footer>
    </div>
  );
}

/* =============================
   UI bits
============================= */

function Card({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.78, fontSize: 13, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950, marginTop: 6 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.panelMini}>
      <div style={{ opacity: 0.78, fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ fontWeight: 950, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function btnLink(): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    cursor: "pointer",
    fontWeight: 900,
    textDecoration: "none",
    color: "black",
    display: "inline-block",
  };
}

/* =============================
   STYLES
============================= */

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#eef4ff",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "stretch",
    flexWrap: "wrap",
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  panelMini: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
  },
  hustleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    alignItems: "start",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    background: "white",
  },
};
