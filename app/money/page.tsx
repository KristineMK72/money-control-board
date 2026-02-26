"use client";

import React from "react";
import Link from "next/link";
import type { Bucket, BucketKey, Entry } from "./types";
import { clampMoney, fmt } from "./utils";
import { useMoneyStore } from "./store";

/* =============================
   BUTTONS / LINKS
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
  if (kind === "danger") return { ...base, border: "1px solid rgba(180,0,0,0.35)", color: "rgb(140,0,0)" };
  return base;
}

export function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
}

/* =============================
   SMALL UI
============================= */

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

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.72, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

export function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

/* =============================
   SHELL (shared page wrapper)
============================= */

export function MoneyShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>{title}</h1>
          {subtitle ? <div style={{ opacity: 0.78, marginTop: 6 }}>{subtitle}</div> : null}

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/money" style={linkBtn()}>
              Dashboard
            </Link>
            <Link href="/money/bills" style={linkBtn()}>
              Bills/Debt
            </Link>
            <Link href="/money/income" style={linkBtn()}>
              Income
            </Link>
            <Link href="/money/plan" style={linkBtn()}>
              Plan
            </Link>
            <Link href="/money/add" style={linkBtn()}>
              Add/Edit
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/money" style={linkBtn()}>
            Back
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}

/* =============================
   BUCKETS UI
============================= */

export function BucketGrid({ children }: { children: React.ReactNode }) {
  return <div style={styles.bucketGrid}>{children}</div>;
}

export function BucketCard({ bucket }: { bucket: Bucket }) {
  const target = bucket.target;
  const saved = bucket.saved;
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
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
                Monthly Target: {fmt(clampMoney(bucket.monthlyTarget ?? bucket.target))} · Due day: {bucket.dueDay ?? "—"}
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

/* =============================
   INCOME UI
============================= */

export function SummaryRow() {
  const { totals } = useMoneyStore();
  return (
    <div style={styles.grid3}>
      <SummaryCard title="Income Logged" value={fmt(totals.income)} />
      <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
      <SummaryCard title="Unassigned" value={fmt(totals.unassigned)} hint="What you can allocate next." />
    </div>
  );
}

export function IncomeForm() {
  const s = useMoneyStore();
  return (
    <>
      <Section title="Log Income" />
      <div style={styles.formRow}>
        <input type="date" value={s.entryDate} onChange={(e) => s.setEntryDate(e.target.value)} style={styles.input} />
        <select value={s.entrySource} onChange={(e) => s.setEntrySource(e.target.value as any)} style={styles.input}>
          <option>Salon</option>
          <option>DoorDash</option>
          <option>Other</option>
        </select>
        <input
          placeholder="Amount"
          value={s.entryAmount || ""}
          onChange={(e) => s.setEntryAmount(Number(e.target.value))}
          style={styles.input}
        />
        <button onClick={s.addIncome} style={btn()}>
          Add
        </button>
      </div>
    </>
  );
}

export function AllocateForm() {
  const s = useMoneyStore();
  return (
    <>
      <Section title="Allocate Unassigned" />
      <div style={styles.allocRow}>
        <select value={s.allocKey} onChange={(e) => s.setAllocKey(e.target.value)} style={styles.input}>
          {s.buckets.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Amount"
          value={s.allocAmt || ""}
          onChange={(e) => s.setAllocAmt(Number(e.target.value))}
          style={styles.input}
        />
        <button onClick={s.allocateUnassigned} style={btn()}>
          Allocate
        </button>
        <button onClick={s.autoFundEssentials} style={btn()}>
          Auto-Fund Essentials
        </button>
      </div>
    </>
  );
}

/* =============================
   ADD/EDIT UI
============================= */

export function AddBucketForm() {
  const s = useMoneyStore();
  return (
    <>
      <Section title="Add a Bucket" subtitle="Bills, credit cards, loans, or rolling buckets." />
      <div style={{ ...styles.panel, marginBottom: 12 }}>
        <div style={styles.grid2}>
          <input placeholder="Name" value={s.newName} onChange={(e) => s.setNewName(e.target.value)} style={styles.input} />
          <input
            placeholder="Target"
            value={s.newTarget || ""}
            onChange={(e) => s.setNewTarget(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <div style={{ height: 8 }} />

        <div style={styles.grid2}>
          <input placeholder="Due (label)" value={s.newDue} onChange={(e) => s.setNewDue(e.target.value)} style={styles.input} />
          <input type="date" value={s.newDueDate} onChange={(e) => s.setNewDueDate(e.target.value)} style={styles.input} />
        </div>

        <div style={{ height: 8 }} />

        <div style={styles.grid3}>
          <select value={s.newKind || "bill"} onChange={(e) => s.setNewKind(e.target.value as any)} style={styles.input}>
            <option value="bill">Bill</option>
            <option value="credit">Credit</option>
            <option value="loan">Loan</option>
          </select>

          <select value={s.newPriority} onChange={(e) => s.setNewPriority(Number(e.target.value) as any)} style={styles.input}>
            <option value={1}>Priority 1</option>
            <option value={2}>Priority 2</option>
            <option value={3}>Priority 3</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white" }}>
            <input type="checkbox" checked={s.newFocus} onChange={(e) => s.setNewFocus(e.target.checked)} />
            <span style={{ fontWeight: 900 }}>Focus</span>
          </label>
        </div>

        <div style={{ height: 8 }} />

        <div style={styles.grid3}>
          <input
            placeholder="Balance (optional)"
            value={s.newBalance || ""}
            onChange={(e) => s.setNewBalance(Number(e.target.value))}
            style={styles.input}
          />
          <input placeholder="APR (optional)" value={s.newApr || ""} onChange={(e) => s.setNewApr(Number(e.target.value))} style={styles.input} />
          <input
            placeholder="Min payment (optional)"
            value={s.newMinPayment || ""}
            onChange={(e) => s.setNewMinPayment(Number(e.target.value))}
            style={styles.input}
          />
        </div>

        <div style={{ height: 10 }} />

        <button onClick={s.addBucket} style={btn()}>
          Add Bucket
        </button>
      </div>
    </>
  );
}

/* =============================
   PLAN UI
============================= */

export function WeekStrip() {
  const s = useMoneyStore();
  return (
    <div style={styles.weekStrip}>
      {s.plan.weeks.map((w) => (
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

export function DailyNeedList() {
  const s = useMoneyStore();
  if (!s.plan.dailyNeed.length) return null;

  return (
    <div style={styles.panel}>
      <div style={{ fontWeight: 950, marginBottom: 8 }}>Daily Need (next 7 days)</div>
      <div style={{ opacity: 0.75, marginBottom: 10, fontSize: 13 }}>
        A calm daily pace based on due dates coming up.
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {s.plan.dailyNeed.map((x) => (
          <div key={x.b.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>
              {x.b.name}{" "}
              <span style={{ opacity: 0.7, fontWeight: 800 }}>
                · Due {x.dueDate} · {x.daysLeft} days left
              </span>
            </div>
            <div style={{ fontWeight: 950 }}>{fmt(x.perDay)}/day</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============================
   STYLES
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
    gap: 10,
    padding: 14,
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
  },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "white",
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
  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
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
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: 8,
  },
  allocRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto auto",
    gap: 8,
  },
  input: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
  },
};
