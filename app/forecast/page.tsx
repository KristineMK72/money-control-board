"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** =============================
 *  Types
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
 *  UI Components (inline styles)
============================= */
function Card({
  title,
  value,
  subtitle,
  children,
}: {
  title: string;
  value?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={ui.card}>
      <div style={ui.cardTitle}>{title}</div>
      {value ? <div style={ui.cardValue}>{value}</div> : null}
      {subtitle ? <div style={ui.cardSub}>{subtitle}</div> : null}
      {children ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={ui.stat}>
      <div style={ui.statLabel}>{label}</div>
      <div style={ui.statValue}>{value}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={ui.fieldRow}>
      <div style={ui.fieldLabel}>{label}</div>
      <input
        inputMode="decimal"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={ui.input}
      />
    </div>
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

  const [weeklyBaseline, setWeeklyBaseline] = useState<number>(350);

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
    return <div style={ui.loading}>Loading forecast…</div>;
  }

  return (
    <div style={ui.shell}>
      {/* Header */}
      <div style={ui.headerCard}>
        <div style={ui.h1}>Forecast</div>
        <div style={ui.sub}>
          Week-to-week carryover + monthly/quarter totals + hustle planner.
        </div>

        <div style={ui.headerRow}>
          <Link href="/money" style={ui.linkBtn}>
            ← Back to Board
          </Link>

          <div style={{ flex: 1 }} />

          <div style={ui.baselineBox}>
            <div style={ui.baselineTitle}>Weekly baseline</div>
            <div style={ui.baselineSub}>Gas / food / basics</div>
            <input
              inputMode="decimal"
              value={String(weeklyBaseline)}
              onChange={(e) => setWeeklyBaseline(Number(e.target.value))}
              style={ui.inputWide}
            />
          </div>
        </div>
      </div>

      {/* Top stats */}
      <div style={ui.statsGrid}>
        <SmallStat label={`Still needed this month (${forecast.thisMonth})`} value={fmt(forecast.monthTotalNeed)} />
        <SmallStat label={`Still needed this quarter (${forecast.thisQuarter})`} value={fmt(forecast.quarterTotalNeed)} />
        <SmallStat label="Week 1 still needed" value={fmt(forecast.hustle.week1Gap)} />
      </div>

      {/* Hustle planner */}
      <Card
        title="Hustle planner"
        subtitle="Quick “what would cover this week?” math."
      >
        <div style={ui.hustleWrap}>
          <div style={ui.hustleCol}>
            <div style={ui.blockTitle}>Spatialytics</div>
            <NumField label="Avg $ per job" value={spatialyticsPerJob} onChange={setSpatialyticsPerJob} />
            <NumField label="Jobs per week" value={spatialyticsJobsPerWeek} onChange={setSpatialyticsJobsPerWeek} />
            <div style={ui.line}>
              Weekly from Spatialytics: <b>{fmt(forecast.hustle.spatialyticsWeekly)}</b>
            </div>
          </div>

          <div style={ui.hustleCol}>
            <div style={ui.blockTitle}>Grit &amp; Grace</div>
            <NumField label="Profit per sale" value={gritProfitPerSale} onChange={setGritProfitPerSale} />
            <NumField label="Sales per week" value={gritSalesPerWeek} onChange={setGritSalesPerWeek} />
            <div style={ui.line}>
              Weekly from G&amp;G: <b>{fmt(forecast.hustle.gritWeekly)}</b>
            </div>
          </div>

          <div style={ui.hustleCol}>
            <div style={ui.blockTitle}>Gap coverage</div>
            <div style={ui.kicker}>Combined hustle this week</div>
            <div style={ui.big}>{fmt(forecast.hustle.hustleWeekly)}</div>

            <div style={{ ...ui.kicker, marginTop: 10 }}>Remaining after hustle (Week 1)</div>
            <div style={ui.bigSm}>{fmt(forecast.hustle.remainingAfterHustle)}</div>

            <div style={ui.note}>
              If you wanted to cover the rest with only:
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
                <li>G&amp;G: ~{forecast.hustle.moreGritSalesNeeded} more sales</li>
                <li>Spatialytics: ~{forecast.hustle.moreSpatialyticsJobsNeeded} more jobs</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Weeks */}
      <div style={ui.sectionTitle}>13-week carryover</div>

      <div style={{ display: "grid", gap: 12 }}>
        {forecast.rows.map((r) => (
          <details key={r.start} style={ui.details}>
            <summary style={ui.summary}>
              <div style={ui.weekTop}>
                <div style={ui.weekTitle}>
                  {r.label} <span style={ui.weekRange}>({r.range})</span>
                </div>
                <div style={ui.weekNeed}>Still need: {fmt(r.stillNeed)}</div>
              </div>

              <div style={ui.weekMiniGrid}>
                <div style={ui.miniBox}>
                  <div style={ui.miniLabel}>Bills due</div>
                  <div style={ui.miniVal}>{fmt(r.bills)}</div>
                </div>
                <div style={ui.miniBox}>
                  <div style={ui.miniLabel}>Baseline</div>
                  <div style={ui.miniVal}>{fmt(r.baseline)}</div>
                </div>
                <div style={ui.miniBox}>
                  <div style={ui.miniLabel}>Income logged</div>
                  <div style={ui.miniVal}>{fmt(r.income)}</div>
                </div>
              </div>

              <div style={ui.tapHint}>Tap for total need details ▾</div>
            </summary>

            <div style={ui.detailBody}>
              <div style={ui.miniLabel}>Total need this week (incl carryover)</div>
              <div style={{ ...ui.bigSm, marginTop: 6 }}>{fmt(r.needTotal)}</div>
              <div style={{ ...ui.note, marginTop: 10 }}>
                Total need = bills due + baseline + whatever was still needed from last week.
              </div>
            </div>
          </details>
        ))}
      </div>

      <div style={ui.footer}>
        Uses your bucket “remaining” (target - saved) and logged income entries. Next step is adding real expenses and/or recurring schedules.
      </div>
    </div>
  );
}

/** =============================
 *  Styles (readable, mobile-first)
============================= */
const ui: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 780,
    margin: "0 auto",
    padding: 16,
    paddingBottom: 130, // IMPORTANT: keeps content above BottomNav
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "white",
  },
  loading: {
    maxWidth: 780,
    margin: "0 auto",
    padding: 16,
    paddingBottom: 130,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "rgba(255,255,255,0.8)",
  },

  headerCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    padding: 14,
    boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  },
  h1: { fontSize: 26, fontWeight: 950, letterSpacing: -0.2 },
  sub: { marginTop: 6, fontSize: 14, color: "rgba(255,255,255,0.75)" },

  headerRow: {
    marginTop: 12,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  linkBtn: {
    display: "inline-block",
    textDecoration: "none",
    color: "white",
    fontWeight: 850,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
  },

  baselineBox: {
    minWidth: 260,
    maxWidth: "100%",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
  },
  baselineTitle: { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.8)" },
  baselineSub: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.65)" },
  inputWide: {
    marginTop: 8,
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.45)",
    color: "white",
    fontWeight: 800,
    outline: "none",
  },

  statsGrid: {
    marginTop: 12,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "1fr",
  },

  stat: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    padding: 14,
  },
  statLabel: { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.75)" },
  statValue: { marginTop: 8, fontSize: 24, fontWeight: 950 },

  card: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    padding: 14,
    boxShadow: "0 10px 40px rgba(0,0,0,0.22)",
  },
  cardTitle: { fontSize: 14, fontWeight: 950 },
  cardValue: { marginTop: 8, fontSize: 26, fontWeight: 950 },
  cardSub: { marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.7)" },

  hustleWrap: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },
  hustleCol: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    padding: 12,
  },
  blockTitle: { fontSize: 13, fontWeight: 950, color: "rgba(255,255,255,0.9)" },

  fieldRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  fieldLabel: { fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.75)" },
  input: {
    width: 140,
    maxWidth: "45vw",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.45)",
    color: "white",
    fontWeight: 900,
    outline: "none",
    textAlign: "right",
  },

  line: { marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  kicker: { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.7)" },
  big: { marginTop: 6, fontSize: 28, fontWeight: 950 },
  bigSm: { fontSize: 22, fontWeight: 950 },
  note: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.35 },

  sectionTitle: { marginTop: 16, fontSize: 18, fontWeight: 950 },

  details: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    padding: 12,
  },
  summary: {
    listStyle: "none",
    cursor: "pointer",
    outline: "none",
  },
  weekTop: {
    display: "flex",
    gap: 8,
    justifyContent: "space-between",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  weekTitle: { fontSize: 14, fontWeight: 950 },
  weekRange: { fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.65)" },
  weekNeed: { fontSize: 14, fontWeight: 950 },

  weekMiniGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  miniBox: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    padding: 10,
  },
  miniLabel: { fontSize: 11, fontWeight: 950, color: "rgba(255,255,255,0.7)" },
  miniVal: { marginTop: 6, fontSize: 13, fontWeight: 950 },

  tapHint: { marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.55)" },

  detailBody: {
    marginTop: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.35)",
    padding: 12,
  },

  footer: {
    marginTop: 16,
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.35,
    paddingBottom: 20,
  },
};
