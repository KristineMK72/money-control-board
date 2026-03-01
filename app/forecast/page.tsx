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

// ⚠️ MUST MATCH your /money page key
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

/* =============================
   UI bits (INLINE styles so it NEVER breaks)
============================= */

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
      <div style={S.cardValue}>{value}</div>
      {subtitle ? <div style={S.cardSub}>{subtitle}</div> : null}
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
    <label style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      <input
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={S.input}
      />
    </label>
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

  // baseline per week
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

  const data = useMemo(() => {
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

    // Carryover pacing
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

    // ✅ FIXED totals: do NOT sum stillNeed (carryover repeats)
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
      },
      rows,
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

  if (!loaded) return <div style={S.loading}>Loading forecast…</div>;

  return (
    <div style={S.shell}>
      <div style={S.hero}>
        <div>
          <div style={S.h1}>Forecast</div>
          <div style={S.sub}>
            Month/quarter totals (no double counting) + a week-to-week carryover “pacing” view.
          </div>

          <div style={{ marginTop: 12 }}>
            <Link href="/money" style={S.btn}>
              ← Back to Board
            </Link>
          </div>
        </div>

        <div style={S.cardMini}>
          <div style={S.miniTop}>Weekly baseline</div>
          <div style={S.miniSub}>Gas / food / basics</div>
          <input
            inputMode="decimal"
            value={String(weeklyBaseline)}
            onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
            style={S.input}
          />
        </div>
      </div>

      <div style={S.grid3}>
        <Card
          title={`Needed this month (${data.thisMonth})`}
          value={fmt(data.totals.monthNeed)}
          subtitle={`Baseline ${fmt(data.totals.monthBaselineTotal)} + Bills ${fmt(
            data.totals.monthBills
          )} − Income ${fmt(data.totals.monthIncome)}`}
        />
        <Card
          title={`Needed this quarter (${data.thisQuarter})`}
          value={fmt(data.totals.quarterNeed)}
          subtitle={`Baseline ${fmt(data.totals.quarterBaselineTotal)} + Bills ${fmt(
            data.totals.quarterBills
          )} − Income ${fmt(data.totals.quarterIncome)}`}
        />
        <Card
          title="Week 1 gap (carryover pacing)"
          value={fmt(data.hustle.week1Gap)}
          subtitle="This is the running carryover model."
        />
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Hustle planner</div>
        <div style={S.sectionSub}>Mobile-friendly inputs (labels above, no squish).</div>

        <div style={S.grid2}>
          <div style={S.innerCard}>
            <div style={S.blockTitle}>Spatialytics</div>
            <Field label="Avg $ per job" value={spatialyticsPerJob} onChange={setSpatialyticsPerJob} />
            <Field
              label="Jobs per week"
              value={spatialyticsJobsPerWeek}
              onChange={setSpatialyticsJobsPerWeek}
            />
            <div style={S.line}>
              Weekly from Spatialytics: <b>{fmt(data.hustle.spatialyticsWeekly)}</b>
            </div>
          </div>

          <div style={S.innerCard}>
            <div style={S.blockTitle}>Grit &amp; Grace</div>
            <Field label="Profit per sale" value={gritProfitPerSale} onChange={setGritProfitPerSale} />
            <Field label="Sales per week" value={gritSalesPerWeek} onChange={setGritSalesPerWeek} />
            <div style={S.line}>
              Weekly from G&amp;G: <b>{fmt(data.hustle.gritWeekly)}</b>
            </div>
          </div>
        </div>

        <div style={{ ...S.innerCard, marginTop: 12 }}>
          <div style={S.blockTitle}>Gap coverage (Week 1)</div>
          <div style={S.bigRow}>
            <div>
              <div style={S.muted}>Combined hustle this week</div>
              <div style={S.big}>{fmt(data.hustle.hustleWeekly)}</div>
            </div>
            <div>
              <div style={S.muted}>Remaining after hustle</div>
              <div style={S.big}>{fmt(data.hustle.remainingAfterHustle)}</div>
            </div>
          </div>

          <div style={S.note}>
            If you covered the rest with only:
            <ul style={{ margin: "8px 0 0 18px" }}>
              <li>G&amp;G: ~{data.hustle.moreGritSalesNeeded} more sales</li>
              <li>Spatialytics: ~{data.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={S.sectionTitle}>13-week carryover pacing</div>
        <div style={S.sectionSub}>
          Tap a week to open details (keeps it readable).
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {data.rows.map((r) => (
          <details key={r.start} style={S.weekCard}>
            <summary style={S.weekSummary}>
              <div style={{ fontWeight: 900 }}>{r.label}</div>
              <div style={{ fontWeight: 950 }}>{fmt(r.stillNeed)}</div>
            </summary>

            <div style={S.weekDetails}>
              <div style={S.kv}>
                <span style={S.k}>Bills due</span>
                <span style={S.v}>{fmt(r.bills)}</span>
              </div>
              <div style={S.kv}>
                <span style={S.k}>Baseline</span>
                <span style={S.v}>{fmt(r.baseline)}</span>
              </div>
              <div style={S.kv}>
                <span style={S.k}>Income logged</span>
                <span style={S.v}>{fmt(r.income)}</span>
              </div>
              <div style={S.kv}>
                <span style={S.k}>Total need</span>
                <span style={S.v}>{fmt(r.needTotal)}</span>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div style={S.footer}>
        Month/Quarter totals are <b>baseline + bills − income</b> (no double-counting carryover).
        The weekly list is a pacing model where any “uncovered need” rolls forward.
      </div>
    </div>
  );
}

/* =============================
   STYLES
============================= */

const S: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 920,
    margin: "0 auto",
    padding: 16,
    paddingBottom: 120, // room for BottomNav
    color: "white",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  loading: {
    maxWidth: 920,
    margin: "0 auto",
    padding: 16,
    paddingBottom: 120,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },

  hero: {
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "stretch",
    flexWrap: "wrap",
  },
  h1: { fontSize: 34, fontWeight: 950, letterSpacing: -0.5 },
  sub: { marginTop: 6, opacity: 0.8, maxWidth: 520, lineHeight: 1.4 },

  btn: {
    display: "inline-block",
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.10)",
    color: "white",
    textDecoration: "none",
    fontWeight: 900,
  },

  cardMini: {
    minWidth: 260,
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
  },
  miniTop: { fontSize: 14, fontWeight: 950 },
  miniSub: { marginTop: 4, fontSize: 12, opacity: 0.8 },
  input: {
    marginTop: 10,
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    outline: "none",
    fontSize: 16,
  },

  grid3: {
    marginTop: 12,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },

  card: {
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.32)",
    backdropFilter: "blur(10px)",
  },
  cardTitle: { fontSize: 12, fontWeight: 900, opacity: 0.8 },
  cardValue: { marginTop: 8, fontSize: 32, fontWeight: 950, letterSpacing: -0.5 },
  cardSub: { marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.4 },

  sectionTitle: { fontSize: 20, fontWeight: 950, letterSpacing: -0.2 },
  sectionSub: { marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.4 },

  grid2: {
    marginTop: 12,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  innerCard: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)",
  },
  blockTitle: { fontWeight: 950, marginBottom: 8 },

  field: { display: "block", marginTop: 10 },
  fieldLabel: { fontSize: 12, fontWeight: 800, opacity: 0.85, marginBottom: 6 },

  line: { marginTop: 12, opacity: 0.9, lineHeight: 1.4 },

  bigRow: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  muted: { fontSize: 12, opacity: 0.78, fontWeight: 800 },
  big: { fontSize: 26, fontWeight: 950, marginTop: 6 },

  note: { marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.4 },

  weekCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    overflow: "hidden",
  },
  weekSummary: {
    listStyle: "none",
    cursor: "pointer",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  weekDetails: {
    borderTop: "1px solid rgba(255,255,255,0.10)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  kv: { display: "flex", justifyContent: "space-between", gap: 10 },
  k: { opacity: 0.78, fontSize: 12, fontWeight: 800 },
  v: { fontWeight: 950 },

  footer: {
    marginTop: 14,
    opacity: 0.7,
    fontSize: 12,
    lineHeight: 1.4,
  },
};
