"use client";

import React, { useMemo, useState } from "react";
import type { Bucket, BucketKey, PlanItem, WeekPlan, Entry } from "@/lib/money/types";
import { fmt, clampMoney } from "@/lib/money/utils";
import { useMoneyStore } from "@/lib/money/store";

/** ---------------------------
 * Expected store shape
 * (Adjust your store.ts to match these names)
---------------------------- */
type StoreShape = {
  buckets: Bucket[];
  entries: Entry[];

  totals: {
    income: number;
    allocated: number;
    unassigned: number;
  };

  plan: {
    weeks: WeekPlan[];
    dailyNeed: PlanItem[];
  };

  // actions
  addIncome: (payload: { dateISO: string; source: Entry["source"]; amount: number; note?: string }) => void;
  allocateAmount: (key: BucketKey, amount: number) => void;
  resetAll: () => void;

  addBucket: (payload: Partial<Bucket> & { name: string; target: number }) => void;
};

function useStore(): StoreShape {
  return useMoneyStore() as any;
}

/* =============================
   SHARED STYLES
============================= */

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
    background: "#eef4ff",
    minHeight: "100vh",
  },
  topNav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
  },
  navBtns: { display: "flex", gap: 8, flexWrap: "wrap" },
  content: { marginTop: 12 },

  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "white",
  },
  section: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 950 },
  sectionSub: { opacity: 0.72, marginTop: 4 },

  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
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
  footer: { marginTop: 24, opacity: 0.7, fontSize: 13 },
};

function btn(kind: "default" | "danger" = "default"): React.CSSProperties {
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

function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
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
   LAYOUT / WRAPPERS
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
  const store = useStore();

  return (
    <div style={styles.shell}>
      <div style={styles.topNav}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{title}</div>
          {subtitle ? <div style={{ opacity: 0.78, marginTop: 6 }}>{subtitle}</div> : null}

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/money" style={linkBtn()}>
              Dashboard
            </a>
            <a href="/money/bills" style={linkBtn()}>
              Bills/Debt
            </a>
            <a href="/money/income" style={linkBtn()}>
              Income
            </a>
            <a href="/money/plan" style={linkBtn()}>
              Plan
            </a>
            <a href="/money/add" style={linkBtn()}>
              Add/Edit
            </a>
          </div>
        </div>

        <div style={styles.navBtns}>
          <button onClick={store.resetAll} style={btn("danger")}>
            Reset
          </button>
        </div>
      </div>

      <div style={styles.content}>{children}</div>

      <div style={styles.footer}>
        Tip: Add due days for monthly cards/loans so Plan can forecast week-by-week.
      </div>
    </div>
  );
}

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {subtitle ? <div style={styles.sectionSub}>{subtitle}</div> : null}
    </div>
  );
}

/* =============================
   SUMMARY
============================= */

function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string
 function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

/* =============================
   BUCKET CARD
============================= */

export function BucketCard({
  bucket,
  onAllocate,
}: {
  bucket: Bucket;
  onAllocate?: (key: BucketKey, amount: number) => void;
}) {
  const target = bucket.target || 0;
  const saved = bucket.saved || 0;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const rem = target > 0 ? clampMoney(Math.max(0, target - saved)) : 0;

  const dueLabel =
    (bucket.dueDate || "").trim() ? `Due ${bucket.dueDate}` : bucket.due ? bucket.due : "No due date";

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
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                background: "rgba(0,0,0,0.58)",
                borderRadius: 999,
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              opacity: 0.78,
              flexWrap: "wrap",
            }}
          >
            <div>
              <Badge>{pct}%</Badge>
            </div>
            <div style={{ fontWeight: 900 }}>Remaining: {fmt(rem)}</div>
          </div>

          {onAllocate ? (
            <QuickAllocateRow bucketKey={bucket.key} onAllocate={onAllocate} />
          ) : null}
        </>
      ) : (
        <div style={{ marginTop: 8, opacity: 0.75 }}>Rolling bucket (no fixed target)</div>
      )}
    </div>
  );
}

function QuickAllocateRow({
  bucketKey,
  onAllocate,
}: {
  bucketKey: BucketKey;
  onAllocate: (key: BucketKey, amount: number) => void;
}) {
  const [amt, setAmt] = useState<number>(0);

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        placeholder="Allocate amount"
        value={amt || ""}
        onChange={(e) => setAmt(Number(e.target.value))}
        style={{ ...styles.input, width: 180 }}
      />
      <button
        style={btn()}
        onClick={() => {
          onAllocate(bucketKey, amt);
          setAmt(0);
        }}
      >
        Allocate
      </button>
    </div>
  );
}

/* =============================
   PAGES / DASHBOARDS
============================= */

export function MasterDashboard() {
  const store = useStore();

  const focusRemaining = useMemo(() => {
    return clampMoney(
      store.buckets
        .filter((b) => !!b.focus && (b.target || 0) > 0)
        .reduce((s, b) => s + Math.max(0, (b.target || 0) - (b.saved || 0)), 0)
    );
  }, [store.buckets]);

  const creditBalances = useMemo(() => {
    return clampMoney(
      store.buckets
        .filter((b) => b.kind === "credit" && b.balance != null)
        .reduce((s, b) => s + (b.balance || 0), 0)
    );
  }, [store.buckets]);

  const loanBalances = useMemo(() => {
    return clampMoney(
      store.buckets
        .filter((b) => b.kind === "loan" && b.balance != null)
        .reduce((s, b) => s + (b.balance || 0), 0)
    );
  }, [store.buckets]);

  return (
    <MoneyShell title="Money Control Board" subtitle="Master dashboard (everything ties together)">
      <div style={styles.grid3}>
        <SummaryCard title="Income Logged" value={fmt(store.totals.income)} />
        <SummaryCard title="Allocated" value={fmt(store.totals.allocated)} />
        <SummaryCard title="Unassigned" value={fmt(store.totals.unassigned)} hint="What you can allocate next." />
      </div>

      <Section title="At-a-glance" />
      <div style={styles.grid3}>
        <SummaryCard title="Focus Buckets Remaining" value={fmt(focusRemaining)} hint="How much your ‘now’ list still needs." />
        <SummaryCard title="Credit Balances" value={fmt(creditBalances)} hint="Sum of credit cards with balances." />
        <SummaryCard title="Loan Balances" value={fmt(loanBalances)} hint="Sum of loans with balances." />
      </div>

      <Section title="Quick links" subtitle="Use the sub-pages for the detailed dashboards." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div style={styles.panel}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Bills/Debt</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>See buckets + allocate money + view balances.</div>
          <div style={{ marginTop: 12 }}>
            <a href="/money/bills" style={linkBtn()}>
              Open Bills/Debt
            </a>
          </div>
        </div>
        <div style={styles.panel}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Plan</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Weekly income needed + daily pace.</div>
          <div style={{ marginTop: 12 }}>
            <a href="/money/plan" style={linkBtn()}>
              Open Plan
            </a>
          </div>
        </div>
        <div style={styles.panel}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Income</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Log income entries (Salon / DoorDash / Other).</div>
          <div style={{ marginTop: 12 }}>
            <a href="/money/income" style={linkBtn()}>
              Open Income
            </a>
          </div>
        </div>
        <div style={styles.panel}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Add/Edit</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Add a new bill, credit card, or loan bucket.</div>
          <div style={{ marginTop: 12 }}>
            <a href="/money/add" style={linkBtn()}>
              Open Add/Edit
            </a>
          </div>
        </div>
      </div>
    </MoneyShell>
  );
}

export function BillsDebtDashboard() {
  const store = useStore();

  const focus = useMemo(() => store.buckets.filter((b) => !!b.focus), [store.buckets]);
  const other = useMemo(() => store.buckets.filter((b) => !b.focus), [store.buckets]);

  return (
    <MoneyShell title="Bills / Debt" subtitle="Allocate unassigned money and track balances.">
      <div style={styles.grid3}>
        <SummaryCard title="Unassigned" value={fmt(store.totals.unassigned)} hint="Allocate this next." />
        <SummaryCard title="Credit Balances" value={fmt(store.buckets.filter(b=>b.kind==="credit"&&b.balance!=null).reduce((s,b)=>s+(b.balance||0),0))} />
        <SummaryCard title="Loan Balances" value={fmt(store.buckets.filter(b=>b.kind==="loan"&&b.balance!=null).reduce((s,b)=>s+(b.balance||0),0))} />
      </div>

      <Section title="Focus Buckets" subtitle="Your most urgent list." />
      <div style={styles.bucketGrid}>
        {focus.map((b) => (
          <BucketCard key={b.key} bucket={b} onAllocate={store.allocateAmount} />
        ))}
      </div>

      <Section title="Other Buckets" />
      <div style={styles.bucketGrid}>
        {other.map((b) => (
          <BucketCard key={b.key} bucket={b} onAllocate={store.allocateAmount} />
        ))}
      </div>
    </MoneyShell>
  );
}

export function IncomeDashboard() {
  const store = useStore();

  const [dateISO, setDateISO] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<Entry["source"]>("Salon");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");

  return (
    <MoneyShell title="Income" subtitle="Log money coming in so you can allocate it to buckets.">
      <div style={styles.grid3}>
        <SummaryCard title="Income Logged" value={fmt(store.totals.income)} />
        <SummaryCard title="Allocated" value={fmt(store.totals.allocated)} />
        <SummaryCard title="Unassigned" value={fmt(store.totals.unassigned)} hint="What you can allocate next." />
      </div>

      <Section title="Log income" />
      <div style={styles.panel}>
        <div style={styles.formRow}>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={styles.input} />
          <select value={source} onChange={(e) => setSource(e.target.value as any)} style={styles.input}>
            <option>Salon</option>
            <option>DoorDash</option>
            <option>Other</option>
          </select>
          <input
            placeholder="Amount"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={styles.input}
          />
          <button
            onClick={() => {
              store.addIncome({ dateISO, source, amount, note: note.trim() || undefined });
              setAmount(0);
              setNote("");
            }}
            style={btn()}
          >
            Add
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...styles.input, width: "100%" }}
          />
        </div>
      </div>

      <Section title="Recent entries" subtitle="(This is basic for now — we can make it nicer next.)" />
      <div style={{ display: "grid", gap: 10 }}>
        {store.entries.slice(0, 12).map((e) => (
          <div key={e.id} style={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>
                {e.dateISO} · {e.source} {e.note ? <span style={{ opacity: 0.7 }}>· {e.note}</span> : null}
              </div>
              <div style={{ fontWeight: 950 }}>{fmt(e.amount)}</div>
            </div>
          </div>
        ))}
        {store.entries.length === 0 ? <div style={{ opacity: 0.7 }}>No income logged yet.</div> : null}
      </div>
    </MoneyShell>
  );
}

export function PlanDashboard() {
  const store = useStore();

  return (
    <MoneyShell title="Plan" subtitle="How much income you need each week so you’re not strapped.">
      <Section
        title="Income Needed Each Week"
        subtitle="This is based on remaining amounts for buckets with due dates (and monthly due-days)."
      />

      <div style={styles.weekStrip}>
        {store.plan.weeks.map((w) => (
          <div key={w.label} style={styles.panel}>
            <div style={{ fontSize: 13, opacity: 0.78, fontWeight: 900 }}>{w.label}</div>
            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 8 }}>{fmt(w.total)}</div>
            <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
              Daily pace: <b>{fmt(w.total / 7)}</b>
            </div>
          </div>
        ))}
      </div>

      <Section title="Daily need (next 7–10 days)" subtitle="If something is due soon, this shows a calm daily pace." />
      <div style={{ display: "grid", gap: 10 }}>
        {store.plan.dailyNeed.map((x) => (
          <div key={x.b.key} style={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>
                {x.b.name}{" "}
                <span style={{ opacity: 0.7, fontWeight: 800 }}>
                  · due {x.dueDate} · days left: {x.daysLeft}
                </span>
              </div>
              <div style={{ fontWeight: 950 }}>{fmt(x.rem)}</div>
            </div>
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              Daily pace: <b>{fmt(x.perDay)}</b>
            </div>
          </div>
        ))}
        {store.plan.dailyNeed.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nothing due in the next week (or no due dates set).</div>
        ) : null}
      </div>
    </MoneyShell>
  );
}

export function AddEditDashboard() {
  const store = useStore();

  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(0);
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [focus, setFocus] = useState<boolean>(true);
  const [kind, setKind] = useState<Bucket["kind"]>("bill");

  const [dueDate, setDueDate] = useState<string>("");
  const [dueNote, setDueNote] = useState<string>("");

  const [balance, setBalance] = useState<number>(0);
  const [minPayment, setMinPayment] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [apr, setApr] = useState<number>(0);

  const [isMonthly, setIsMonthly] = useState<boolean>(false);
  const [monthlyTarget, setMonthlyTarget] = useState<number>(0);
  const [dueDay, setDueDay] = useState<number>(1);

  return (
    <MoneyShell title="Add / Edit" subtitle="Add new bills, credit cards, or loans (we’ll build full edit next).">
      <Section title="Add a new bucket" />
      <div style={styles.panel}>
        <div style={{ display: "grid", gap: 10 }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input
              placeholder="Target / Amount due"
              value={target || ""}
              onChange={(e) => setTarget(Number(e.target.value))}
              style={styles.input}
            />
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as any)} style={styles.input}>
              <option value={1}>Priority 1</option>
              <option value={2}>Priority 2</option>
              <option value={3}>Priority 3</option>
            </select>
            <select value={kind || "bill"} onChange={(e) => setKind(e.target.value as any)} style={styles.input}>
              <option value="bill">Bill</option>
              <option value="credit">Credit Card</option>
              <option value="loan">Loan</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
              <input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} />
              Focus
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
              <input type="checkbox" checked={isMonthly} onChange={(e) => setIsMonthly(e.target.checked)} />
              Monthly
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={styles.input} />
            <input placeholder="Due note (optional)" value={dueNote} onChange={(e) => setDueNote(e.target.value)} style={styles.input} />
          </div>

          {kind !== "bill" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <input placeholder="Balance" value={balance || ""} onChange={(e) => setBalance(Number(e.target.value))} style={styles.input} />
              <input placeholder="Min payment" value={minPayment || ""} onChange={(e) => setMinPayment(Number(e.target.value))} style={styles.input} />
              <input placeholder="Limit" value={creditLimit || ""} onChange={(e) => setCreditLimit(Number(e.target.value))} style={styles.input} />
              <input placeholder="APR %" value={apr || ""} onChange={(e) => setApr(Number(e.target.value))} style={styles.input} />
            </div>
          ) : null}

          {isMonthly ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Monthly target"
                value={monthlyTarget || ""}
                onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                style={styles.input}
              />
              <input
                placeholder="Due day (1-31)"
                value={dueDay || ""}
                onChange={(e) => setDueDay(Number(e.target.value))}
                style={styles.input}
              />
            </div>
          ) : null}

          <button
            style={btn()}
            onClick={() => {
              if (!name.trim()) return;
              store.addBucket({
                name: name.trim(),
                target,
                priority,
                focus,
                kind,
                dueDate: dueDate.trim() || "",
                due: dueNote.trim() || undefined,
                balance: kind !== "bill" ? balance : undefined,
                minPayment: kind !== "bill" ? minPayment : undefined,
                creditLimit: kind !== "bill" ? creditLimit : undefined,
                apr: kind !== "bill" ? apr : undefined,
                isMonthly,
                monthlyTarget: isMonthly ? monthlyTarget : undefined,
                dueDay: isMonthly ? dueDay : undefined,
              });

              setName("");
              setTarget(0);
              setPriority(2);
              setFocus(true);
              setKind("bill");
              setDueDate("");
              setDueNote("");
              setBalance(0);
              setMinPayment(0);
              setCreditLimit(0);
              setApr(0);
              setIsMonthly(false);
              setMonthlyTarget(0);
              setDueDay(1);
            }}
          >
            Add bucket
          </button>
        </div>
      </div>

      <Section title="Current buckets" subtitle="(Edit UI comes next — this just confirms the list.)" />
      <div style={{ display: "grid", gap: 10 }}>
        {store.buckets.map((b) => (
          <div key={b.key} style={styles.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950 }}>
                {b.name}{" "}
                <span style={{ opacity: 0.7, fontWeight: 800 }}>
                  · {b.kind ?? "bill"} · P{b.priority} {b.focus ? "· Focus" : ""}
                </span>
              </div>
              <div style={{ fontWeight: 950 }}>{fmt(b.target || 0)}</div>
            </div>
          </div>
        ))}
      </div>
    </MoneyShell>
  );
}                               
