"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =============================
   TYPES
============================= */

type BucketKey = string;

type Bucket = {
  key: BucketKey;
  name: string;
  target: number;
  saved: number;
  due?: string;
  priority: 1 | 2 | 3;
  focus?: boolean;
};

type Entry = {
  id: string;
  dateISO: string;
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

const STORAGE_KEY = "money-control-board-v2";

/* =============================
   HELPERS
============================= */

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function slugKey(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "bucket"
  );
}

/* =============================
   COMPONENT
============================= */

export default function MoneyPage() {
  const [buckets, setBuckets] = useState<Bucket[]>([
    { key: "car", name: "Car Repair", target: 300, saved: 0, priority: 1, focus: true },
    { key: "insurance", name: "Insurance", target: 124, saved: 0, priority: 1, focus: true },
    { key: "power", name: "Crow Wing Power", target: 137, saved: 0, priority: 1, focus: true },
    { key: "collections", name: "$100 Before Collections", target: 100, saved: 0, priority: 1, focus: true },
    { key: "tsa", name: "TSA Temp", target: 45, saved: 0, priority: 2, focus: true },
    { key: "bill347", name: "Bill Mar 3", target: 347, saved: 0, priority: 2, focus: true },
    { key: "deb", name: "Deb (owed)", target: 500, saved: 0, priority: 3 },
  ]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [amount, setAmount] = useState(0);
  const [source, setSource] = useState<Entry["source"]>("Salon");

  /* =============================
     LOAD / SAVE LOCAL
  ============================= */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.buckets) setBuckets(parsed.buckets);
      if (parsed?.entries) setEntries(parsed.entries);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ buckets, entries }));
  }, [buckets, entries]);

  /* =============================
     TOTALS
  ============================= */

  const totals = useMemo(() => {
    const income = entries.reduce((s, e) => s + e.amount, 0);
    const allocated = entries.reduce((s, e) => {
      return (
        s +
        Object.values(e.allocations || {}).reduce(
          (x, v) => x + (v || 0),
          0
        )
      );
    }, 0);
    return {
      income: clampMoney(income),
      allocated: clampMoney(allocated),
      unassigned: clampMoney(income - allocated),
    };
  }, [entries]);

  /* =============================
     ACTIONS
  ============================= */

  function addIncome() {
    const amt = clampMoney(amount);
    if (amt <= 0) return;

    const entry: Entry = {
      id: uid(),
      dateISO: todayISO(),
      source,
      amount: amt,
      allocations: {},
    };

    setEntries([entry, ...entries]);
    setAmount(0);
  }

  function resetAll() {
    if (!confirm("Reset board?")) return;
    setEntries([]);
    setBuckets((b) => b.map((x) => ({ ...x, saved: 0 })));
    localStorage.removeItem(STORAGE_KEY);
  }

  /* =============================
     RENDER
  ============================= */

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Money Control Board</h1>
          <div style={{ opacity: 0.7 }}>
            Fund buckets. Reduce stress.
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <a href="/data" style={linkBtn()}>
              View /data (export/import)
            </a>
            <a href="/login" style={linkBtn()}>
              Cloud Mode (login)
            </a>
          </div>
        </div>

        <button onClick={resetAll} style={btn("danger")}>
          Reset
        </button>
      </header>

      {/* SUMMARY */}
      <div style={styles.summaryGrid}>
        <SummaryCard title="Income" value={fmt(totals.income)} />
        <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
        <SummaryCard title="Unassigned" value={fmt(totals.unassigned)} />
      </div>

      {/* LOG INCOME */}
      <section style={{ marginTop: 20 }}>
        <h2>Log Income</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            style={styles.input}
          >
            <option>Salon</option>
            <option>DoorDash</option>
            <option>Other</option>
          </select>

          <input
            value={amount ? String(amount) : ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Amount"
            style={styles.input}
          />

          <button onClick={addIncome} style={btn()}>
            Add
          </button>
        </div>
      </section>

      {/* BUCKETS */}
      <section style={{ marginTop: 30 }}>
        <h2>Buckets</h2>
        <div style={styles.bucketGrid}>
          {buckets.map((b) => (
            <div key={b.key} style={styles.panel}>
              <div style={{ fontWeight: 800 }}>{b.name}</div>
              <div style={{ opacity: 0.7 }}>
                {fmt(b.saved)} / {fmt(b.target)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* =============================
   UI COMPONENTS
============================= */

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.7 }}>{title}</div>
      <div style={{ fontWeight: 900, fontSize: 22 }}>{value}</div>
    </div>
  );
}

function btn(kind: "default" | "danger" = "default"): React.CSSProperties {
  const base = {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  } as React.CSSProperties;

  if (kind === "danger")
    return { ...base, color: "darkred", borderColor: "rgba(150,0,0,0.4)" };

  return base;
}

function linkBtn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    textDecoration: "none",
    fontWeight: 700,
    color: "black",
  };
}

/* =============================
   STYLES
============================= */

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 20,
    fontFamily: "system-ui",
    background: "#f4f4f4",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "white",
    padding: 20,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.1)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 20,
  },
  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  panel: {
    background: "white",
    padding: 16,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.1)",
  },
  input: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.2)",
  },
};
