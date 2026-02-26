"use client";

import React from "react";
import type { Bucket, BucketKey, Entry } from "@/lib/money/types";
import { clampMoney, fmt } from "@/lib/money/utils";

/* =============================
   BUTTONS + LINKS (premium)
============================= */

export function btn(kind: "default" | "danger" | "primary" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid var(--stroke)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--ink)",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: -0.2,
    boxShadow: "var(--shadow2)",
    transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  };

  if (kind === "primary") {
    return {
      ...base,
      background: "rgba(255,255,255,0.92)",
      color: "#0b1020",
      border: "1px solid rgba(255,255,255,0.85)",
    };
  }

  if (kind === "danger") {
    return {
      ...base,
      border: "1px solid rgba(255,120,120,0.35)",
      color: "rgba(255,170,170,0.92)",
      background: "rgba(255,80,80,0.10)",
    };
  }

  return base;
}

export function linkBtn(kind: "default" | "primary" = "default"): React.CSSProperties {
  return {
    ...btn(kind === "primary" ? "primary" : "default"),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

/* =============================
   SMALL UI
============================= */

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: -0.3 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.78, marginTop: 5 }}>{subtitle}</div> : null}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid var(--stroke2)",
        background: "rgba(255,255,255,0.06)",
        color: "var(--ink)",
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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950, letterSpacing: -0.6, color: "var(--ink)" }}>
            {title}
          </h1>
          {subtitle ? <div style={{ opacity: 0.8, marginTop: 6, color: "var(--muted)" }}>{subtitle}</div> : null}
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
      <div style={{ opacity: 0.8, fontSize: 12.5, marginBottom: 8, fontWeight: 900, color: "var(--muted)" }}>
        {title}
      </div>
      <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.6, color: "var(--ink)" }}>{value}</div>
      {hint ? <div style={{ marginTop: 10, opacity: 0.78, fontSize: 13, color: "var(--muted)" }}>{hint}</div> : null}
    </div>
  );
}

export function SummaryRow({ children }: { children: React.ReactNode }) {
  return <div style={styles.summaryGrid}>{children}</div>;
}

/* =============================
   BUCKETS
============================= */

function remaining(bucket: Bucket) {
  const target = bucket.target ?? 0;
  const saved = bucket.saved ?? 0;
  if (target <= 0) return 0;
  return clampMoney(Math.max(0, target - saved));
}

export function BucketCard({ bucket }: { bucket: Bucket }) {
  const target = bucket.target ?? 0;
  const saved = bucket.saved ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const rem = remaining(bucket);

  const dueLabel = (bucket.dueDate || "").trim()
    ? `Due ${bucket.dueDate}`
    : bucket.due
    ? bucket.due
    : "No due date";

  const kindLabel = bucket.kind === "credit" ? "Credit" : bucket.kind === "loan" ? "Loan" : "Bill";

  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 950, color: "var(--ink)" }}>
          {bucket.name}{" "}
          <span style={{ fontWeight: 800, opacity: 0.72, color: "var(--muted)" }}>
            · {kindLabel} · P{bucket.priority} · {dueLabel}
            {bucket.isMonthly ? " · Monthly" : ""}
          </span>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {bucket.balance != null ? <Badge>Balance: {fmt(bucket.balance)}</Badge> : null}
            {bucket.creditLimit != null ? <Badge>Limit: {fmt(bucket.creditLimit)}</Badge> : null}
            {bucket.minPayment != null ? <Badge>Min: {fmt(bucket.minPayment)}</Badge> : null}
            {bucket.apr != null && bucket.apr > 0 ? <Badge>APR: {bucket.apr}%</Badge> : null}
            {bucket.isMonthly ? (
              <Badge>
                Monthly Target: {fmt(clampMoney(bucket.monthlyTarget ?? bucket.target ?? 0))} · Due day: {bucket.dueDay ?? "—"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div style={{ fontWeight: 950, color: "var(--ink)" }}>
          {target > 0 ? `${fmt(saved)} / ${fmt(target)}` : fmt(saved)}
        </div>
      </div>

      {target > 0 ? (
        <>
          <div style={{ height: 12 }} />
          <div style={{ height: 10, background: "rgba(255,255,255,0.07)", borderRadius: 999, border: "1px solid var(--stroke2)" }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "rgba(255,255,255,0.75)",
                borderRadius: 999,
              }}
            />
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 12, opacity: 0.86 }}>
            <div>
              <Badge>{pct}%</Badge>
            </div>
            <div style={{ fontWeight: 900, color: "var(--ink)" }}>Remaining: {fmt(rem)}</div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10, opacity: 0.8, color: "var(--muted)" }}>Rolling bucket (no fixed target)</div>
      )}
    </div>
  );
}

/** Supports both:
 *  <BucketGrid buckets={buckets} />
 *  <BucketGrid>{buckets.map(...)}</BucketGrid>
 */
export function BucketGrid(props: { buckets?: Bucket[]; children?: React.ReactNode }) {
  const { buckets, children } = props;

  return (
    <div style={styles.bucketGrid}>
      {Array.isArray(buckets) ? buckets.map((b) => <BucketCard key={b.key} bucket={b} />) : children}
    </div>
  );
}

/* =============================
   FORMS (controlled via props)
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
  const { entryDate, setEntryDate, entrySource, setEntrySource, entryAmount, setEntryAmount, entryNote, setEntryNote, onAdd } = props;

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
          value={entryAmount || ""}
          onChange={(e) => setEntryAmount(Number(e.target.value))}
          style={styles.input}
          inputMode="decimal"
        />

        <button onClick={onAdd} style={btn("primary")}>
          Add
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
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
        value={allocAmt || ""}
        onChange={(e) => setAllocAmt(Number(e.target.value))}
        style={styles.input}
        inputMode="decimal"
      />

      <button onClick={onAllocate} style={btn("primary")}>
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
      <div style={{ display: "grid", gap: 10 }}>
        <input placeholder="Name" value={p.newName} onChange={(e) => p.setNewName(e.target.value)} style={styles.input} />

        <input
          placeholder="Target (amount)"
          value={p.newTarget || ""}
          onChange={(e) => p.setNewTarget(Number(e.target.value))}
          style={styles.input}
          inputMode="decimal"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Due label (optional)" value={p.newDue} onChange={(e) => p.setNewDue(e.target.value)} style={styles.input} />
          <input type="date" value={p.newDueDate} onChange={(e) => p.setNewDueDate(e.target.value)} style={styles.input} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
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

          <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: "var(--ink)" }}>
            <input type="checkbox" checked={p.newFocus} onChange={(e) => p.setNewFocus(e.target.checked)} />
            Focus
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Balance (optional)" value={p.newBalance || ""} onChange={(e) => p.setNewBalance(Number(e.target.value))} style={styles.input} inputMode="decimal" />
          <input placeholder="APR % (optional)" value={p.newApr || ""} onChange={(e) => p.setNewApr(Number(e.target.value))} style={styles.input} inputMode="decimal" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input placeholder="Min payment (optional)" value={p.newMinPayment || ""} onChange={(e) => p.setNewMinPayment(Number(e.target.value))} style={styles.input} inputMode="decimal" />
          <input placeholder="Credit limit (optional)" value={p.newCreditLimit || ""} onChange={(e) => p.setNewCreditLimit(Number(e.target.value))} style={styles.input} inputMode="decimal" />
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: "var(--ink)" }}>
          <input type="checkbox" checked={p.newIsMonthly} onChange={(e) => p.setNewIsMonthly(e.target.checked)} />
          Monthly bucket
        </label>

        {p.newIsMonthly ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              placeholder="Monthly target"
              value={p.newMonthlyTarget || ""}
              onChange={(e) => p.setNewMonthlyTarget(Number(e.target.value))}
              style={styles.input}
              inputMode="decimal"
            />
            <input
              placeholder="Due day (1-31)"
              value={p.newDueDay || ""}
              onChange={(e) => p.setNewDueDay(Number(e.target.value))}
              style={styles.input}
              inputMode="numeric"
            />
          </div>
        ) : null}

        <button onClick={p.onAdd} style={btn("primary")}>
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
          <div style={{ fontSize: 12.5, opacity: 0.8, fontWeight: 950, color: "var(--muted)" }}>{w.label}</div>
          <div style={{ fontSize: 26, fontWeight: 950, marginTop: 10, letterSpacing: -0.6, color: "var(--ink)" }}>
            {fmt(w.total)}
          </div>
          <div style={{ marginTop: 10, opacity: 0.82, fontSize: 13, color: "var(--muted)" }}>
            Daily pace: <b style={{ color: "var(--ink)" }}>{fmt(w.total / 7)}</b>
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
  if (!items.length) return <div style={{ opacity: 0.8, color: "var(--muted)" }}>No due dates in the next 7 days.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((x) => (
        <div key={`${x.name}-${x.dueDate}`} style={styles.panel}>
          <div style={{ fontWeight: 950, color: "var(--ink)" }}>{x.name}</div>
          <div style={{ marginTop: 8, opacity: 0.82, color: "var(--muted)" }}>
            Due <b style={{ color: "var(--ink)" }}>{x.dueDate}</b> · Remaining <b style={{ color: "var(--ink)" }}>{fmt(x.rem)}</b>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)" }}>
            Daily pace: <b style={{ color: "var(--ink)" }}>{fmt(x.perDay)}</b> · Days left: <b style={{ color: "var(--ink)" }}>{x.daysLeft}</b>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================
   STYLES (exported, premium)
============================= */

export const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 18,
    minHeight: "100vh",
  },

  header: {
    position: "sticky",
    top: 12,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    border: "1px solid var(--stroke)",
    background: "var(--card)",
    backdropFilter: "blur(14px)",
    boxShadow: "var(--shadow)",
  },

  panel: {
    border: "1px solid var(--stroke)",
    borderRadius: 18,
    padding: 16,
    background: "var(--card2)",
    backdropFilter: "blur(12px)",
    boxShadow: "var(--shadow2)",
  },

  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 12,
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
    marginTop: 12,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 12,
  },

  weekStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginTop: 12,
  },

  weekCard: {
    border: "1px solid var(--stroke)",
    borderRadius: 18,
    padding: 16,
    background: "var(--card2)",
    backdropFilter: "blur(12px)",
    boxShadow: "var(--shadow2)",
  },

  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
  },

  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },

  allocRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 10,
  },

  input: {
    padding: 11,
    borderRadius: 14,
    border: "1px solid var(--stroke2)",
    background: "rgba(255,255,255,0.06)",
    color: "var(--ink)",
    outline: "none",
  },
};
