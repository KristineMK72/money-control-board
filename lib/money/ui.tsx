"use client";

import React from "react";
import type { Bucket, BucketKey, Entry } from "@/lib/money/types";
import { clampMoney, fmt } from "@/lib/money/utils";

/* =============================
   BUTTONS + LINKS
============================= */

export function btn(kind: "default" | "danger" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    cursor: "pointer",
    fontWeight: 900,
  };
  if (kind === "danger")
    return { ...base, border: "1px solid rgba(180,0,0,0.35)", color: "rgb(140,0,0)" };
  return base;
}

export function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
}

/* =============================
   SMALL UI
============================= */

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.72, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.75)",
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.92,
      }}
    >
      {children}
    </span>
  );
}

/* =============================
   SHELL
============================= */

export function MoneyShell({
  title = "Money Control Board",
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{title}</h1>
          {subtitle ? <div style={{ opacity: 0.78, marginTop: 6 }}>{subtitle}</div> : null}
        </div>
      </header>

      {children}
    </div>
  );
}

/* =============================
   SUMMARY
============================= */

export function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

export function SummaryRow({ children }: { children: React.ReactNode }) {
  return <div style={styles.summaryGrid}>{children}</div>;
}

/* =============================
   BUCKETS
============================= */

export function BucketCard({ bucket }: { bucket: Bucket }) {
  const target = bucket.target ?? 0;
  const saved = bucket.saved ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const rem = target > 0 ? Math.max(0, target - saved) : 0;

  const dueLabel = (bucket.dueDate || "").trim()
    ? `Due ${bucket.dueDate}`
    : bucket.due
    ? bucket.due
    : "No due date";

  const kindLabel = bucket.kind === "credit" ? "Credit" : bucket.kind === "loan" ? "Loan" : "Bill";

  return (
    <div style={styles.panel}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950 }}>
          {bucket.name}{" "}
          <span style={{ fontWeight: 800, opacity: 0.65 }}>
            · {kindLabel} · P{bucket.priority} · {dueLabel}
            {bucket.isMonthly ? " · Monthly" : ""}
          </span>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {bucket.balance != null ? <Badge>Balance: {fmt(bucket.balance)}</Badge> : null}
            {bucket.creditLimit != null ? <Badge>Limit: {fmt(bucket.creditLimit)}</Badge> : null}
            {bucket.minPayment != null ? <Badge>Min: {fmt(bucket.minPayment)}</Badge> : null}
            {bucket.apr != null && bucket.apr > 0 ? <Badge>APR: {bucket.apr}%</Badge> : null}
            {bucket.isMonthly ? (
              <Badge>
                Monthly Target: {fmt(clampMoney(bucket.monthlyTarget ?? bucket.target))} · Due day:{" "}
                {bucket.dueDay ?? "—"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div style={{ fontWeight: 950 }}>{target > 0 ? `${fmt(saved)} / ${fmt(target)}` : fmt(saved)}</div>
      </div>

      {target > 0 ? (
        <>
          <div style={{ height: 10 }} />
          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 999 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "rgba(0,0,0,0.58)", borderRadius: 999 }} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12, opacity: 0.78 }}>
            <div>
              <Badge>{pct}%</Badge>
            </div>
            <div style={{ fontWeight: 900 }}>Remaining: {fmt(rem)}</div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 8, opacity: 0.75 }}>Rolling bucket (no fixed target)</div>
      )}
    </div>
  );
}

/** ✅ IMPORTANT: BucketGrid uses CHILDREN (matches your pages) */
export function BucketGrid({ children }: { children: React.ReactNode }) {
  return <div style={styles.bucketGrid}>{children}</div>;
}

/* =============================
   FORMS
============================= */

export function IncomeForm(props: {
  entryDate: string;
  setEntryDate: (v: string) => void;
  entrySource: Entry["source"];
  setEntrySource: (v: Entry["source"]) => void;
  entryAmount: number;
  setEntryAmount: (n: number) => void;
  entryNote: string;
  setEntryNote: (v: string) => void;
  onAdd: () => void;
}) {
  const {
    entryDate,
    setEntryDate,
    entrySource,
    setEntrySource,
    entryAmount,
    setEntryAmount,
    entryNote,
    setEntryNote,
    onAdd,
  } = props;

  return (
    <>
      <div style={styles.formRow}>
        <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={styles.input} />
        <select value={entrySource} onChange={(e) => setEntrySource(e.target.value as any)} style={styles.input}>
          <option>Salon</option>
          <option>DoorDash</option>
          <option>Other</option>
        </select>
        <input
          placeholder="Amount"
          inputMode="decimal"
          value={entryAmount || ""}
          onChange={(e) => setEntryAmount(Number(e.target.value))}
          style={styles.input}
        />
        <button onClick={onAdd} style={btn()}>
          Add
        </button>
      </div>

      <div style={{ marginTop: 8 }}>
        <input
          placeholder="Note (optional)"
          value={entryNote}
          onChange={(e) => setEntryNote(e.target.value)}
          style={{ ...styles.input, width: "100%" }}
        />
      </div>
    </>
  );
}

export function AllocateForm(props: {
  buckets: Bucket[];
  allocKey: BucketKey;
  setAllocKey: (v: BucketKey) => void;
  allocAmt: number;
  setAllocAmt: (n: number) => void;
  onAllocate: () => void;
}) {
  const { buckets, allocKey, setAllocKey, allocAmt, setAllocAmt, onAllocate } = props;

  return (
    <div style={styles.allocRow}>
      <select value={allocKey} onChange={(e) => setAllocKey(e.target.value as any)} style={styles.input}>
        {buckets.map((b) => (
          <option key={b.key} value={b.key}>
            {b.name}
          </option>
        ))}
      </select>
      <input
        placeholder="Amount"
        inputMode="decimal"
        value={allocAmt || ""}
        onChange={(e) => setAllocAmt(Number(e.target.value))}
        style={styles.input}
      />
      <button onClick={onAllocate} style={btn()}>
        Allocate
      </button>
    </div>
  );
}

export function AddBucketForm(props: {
  newName: string;
  setNewName: (v: string) => void;
  newTarget: number;
  setNewTarget: (n: number) => void;
  newDue: string;
  setNewDue: (v: string) => void;
  newDueDate: string;
  setNewDueDate: (v: string) => void;
  newPriority: 1 | 2 | 3;
  setNewPriority: (v: 1 | 2 | 3) => void;
  newFocus: boolean;
  setNewFocus: (v: boolean) => void;

  newKind: Bucket["kind"];
  setNewKind: (v: Bucket["kind"]) => void;
  newBalance: number;
  setNewBalance: (n: number) => void;
  newApr: number;
  setNewApr: (n: number) => void;
  newMinPayment: number;
  setNewMinPayment: (n: number) => void;
  newCreditLimit: number;
  setNewCreditLimit: (n: number) => void;

  newIsMonthly: boolean;
  setNewIsMonthly: (v: boolean) => void;
  newMonthlyTarget: number;
  setNewMonthlyTarget: (n: number) => void;
  newDueDay: number;
  setNewDueDay: (n: number) => void;

  onAdd: () => void;
}) {
  const p = props;

  return (
    <div style={styles.panel}>
      <div style={{ display: "grid", gap: 8 }}>
        <input placeholder="Name" value={p.newName} onChange={(e) => p.setNewName(e.target.value)} style={styles.input} />

        <input
          placeholder="Target (amount)"
          inputMode="decimal"
          value={p.newTarget || ""}
          onChange={(e) => p.setNewTarget(Number(e.target.value))}
          style={styles.input}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input placeholder="Due label (optional)" value={p.newDue} onChange={(e) => p.setNewDue(e.target.value)} style={styles.input} />
          <input type="date" value={p.newDueDate} onChange={(e) => p.setNewDueDate(e.target.value)} style={styles.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <select value={p.newPriority} onChange={(e) => p.setNewPriority(Number(e.target.value) as any)} style={styles.input}>
            <option value={1}>Priority 1</option>
            <option value={2}>Priority 2</option>
            <option value={3}>Priority 3</option>
          </select>

          <select value={p.newKind || "bill"} onChange={(e) => p.setNewKind(e.target.value as any)} style={styles.input}>
            <option value="bill">Bill</option>
            <option value="credit">Credit</option>
            <option value="loan">Loan</option>
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
            <input type="checkbox" checked={p.newFocus} onChange={(e) => p.setNewFocus(e.target.checked)} />
            Focus
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            placeholder="Balance (optional)"
            inputMode="decimal"
            value={p.newBalance || ""}
            onChange={(e) => p.setNewBalance(Number(e.target.value))}
            style={styles.input}
          />
          <input
            placeholder="APR % (optional)"
            inputMode="decimal"
            value={p.newApr || ""}
            onChange={(e) => p.setNewApr(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            placeholder="Min payment (optional)"
            inputMode="decimal"
            value={p.newMinPayment || ""}
            onChange={(e) => p.setNewMinPayment(Number(e.target.value))}
            style={styles.input}
          />
          <input
            placeholder="Credit limit (optional)"
            inputMode="decimal"
            value={p.newCreditLimit || ""}
            onChange={(e) => p.setNewCreditLimit(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
          <input type="checkbox" checked={p.newIsMonthly} onChange={(e) => p.setNewIsMonthly(e.target.checked)} />
          Monthly bucket
        </label>

        {p.newIsMonthly ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Monthly target"
              inputMode="decimal"
              value={p.newMonthlyTarget || ""}
              onChange={(e) => p.setNewMonthlyTarget(Number(e.target.value))}
              style={styles.input}
            />
            <input
              placeholder="Due day (1-31)"
              inputMode="numeric"
              value={p.newDueDay || ""}
              onChange={(e) => p.setNewDueDay(Number(e.target.value))}
              style={styles.input}
            />
          </div>
        ) : null}

        <button onClick={p.onAdd} style={btn()}>
          Add Bucket
        </button>
      </div>
    </div>
  );
}

/* =============================
   PLAN WIDGETS
============================= */

export function WeekStrip({ weeks }: { weeks: Array<{ label: string; total: number }> }) {
  return (
    <div style={styles.weekStrip}>
      {weeks.map((w) => (
        <div key={w.label} style={styles.weekCard}>
          <div style={{ fontSize: 13, opacity: 0.78, fontWeight: 900 }}>{w.label}</div>
          <div style={{ fontSize: 22, fontWeight: 950, marginTop: 8 }}>{fmt(w.total)}</div>
          <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
            Daily pace: <b>{fmt(w.total / 7)}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyNeedList(props: {
  items: Array<{ name: string; dueDate: string; rem: number; perDay: number; daysLeft: number }>;
}) {
  const { items } = props;
  if (!items.length) return <div style={{ opacity: 0.75 }}>No due dates in the next 7 days.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((x) => (
        <div key={`${x.name}-${x.dueDate}`} style={styles.panel}>
          <div style={{ fontWeight: 950 }}>{x.name}</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Due <b>{x.dueDate}</b> · Remaining <b>{fmt(x.rem)}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            Daily pace: <b>{fmt(x.perDay)}</b> · Days left: <b>{x.daysLeft}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================
   STYLES (exported)
============================= */

export const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
    background: "#eef4ff",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: 14,
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
  },

  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 12,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    marginTop: 12,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 12,
  },
  weekStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginTop: 12,
  },
  weekCard: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "white",
  },
  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "white",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: 8,
  },
  allocRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 8,
  },
  input: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
  },
};
