"use client";

import React, { useMemo, useState } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { Bucket, BucketKey } from "@/lib/money/types";
import { MoneyShell, Section, btn } from "@/lib/money/ui";

/* =============================
   HELPERS
============================= */

function slugKey(name: string) {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "bucket";
}

function clampDayOfMonth(d: number) {
  if (!Number.isFinite(d)) return 1;
  return Math.min(31, Math.max(1, Math.floor(d)));
}

/* =============================
   PAGE
============================= */

export default function AddEditPage() {
  const store = useMoneyStore();

  // ---- form state
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<number>(0);
  const [newDue, setNewDue] = useState("");
  const [newDueDate, setNewDueDate] = useState<string>("");

  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [newFocus, setNewFocus] = useState<boolean>(true);

  const [newKind, setNewKind] = useState<Bucket["kind"]>("bill");
  const [newBalance, setNewBalance] = useState<number>(0);
  const [newApr, setNewApr] = useState<number>(0);
  const [newMinPayment, setNewMinPayment] = useState<number>(0);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);

  const [newIsMonthly, setNewIsMonthly] = useState<boolean>(false);
  const [newMonthlyTarget, setNewMonthlyTarget] = useState<number>(0);
  const [newDueDay, setNewDueDay] = useState<number>(1);

  const existingKeys = useMemo(() => new Set(store.buckets.map((b) => b.key)), [store.buckets]);

  function addBucket() {
    const name = newName.trim();
    if (!name) return;

    const base = slugKey(name);
    let key: BucketKey = base;
    let i = 2;
    while (existingKeys.has(key)) {
      key = `${base}-${i++}`;
    }

    const isMonthly = !!newIsMonthly;

    const bucket: Bucket = {
      key,
      name,

      saved: 0,
      target: Number(newTarget || 0),

      due: (newDue || "").trim() || undefined,
      // IMPORTANT: match common Bucket typing: dueDate is optional
      // If your Bucket type uses `dueDate?: string` (optional), this is correct:
      dueDate: (newDueDate || "").trim() || undefined,

      priority: newPriority,
      focus: newFocus,

      kind: newKind,
      balance: newBalance ? Number(newBalance) : undefined,
      apr: newApr ? Number(newApr) : undefined,
      minPayment: newMinPayment ? Number(newMinPayment) : undefined,
      creditLimit: newCreditLimit ? Number(newCreditLimit) : undefined,

      isMonthly,
      monthlyTarget: isMonthly ? Number(newMonthlyTarget || newTarget || 0) : undefined,
      dueDay: isMonthly ? clampDayOfMonth(Number(newDueDay || 1)) : undefined,
    };

    store.addBucket(bucket);

    // reset
    setNewName("");
    setNewTarget(0);
    setNewDue("");
    setNewDueDate("");
    setNewPriority(2);
    setNewFocus(true);

    setNewKind("bill");
    setNewBalance(0);
    setNewApr(0);
    setNewMinPayment(0);
    setNewCreditLimit(0);

    setNewIsMonthly(false);
    setNewMonthlyTarget(0);
    setNewDueDay(1);
  }

  return (
    <MoneyShell title="Add / Edit" subtitle="Create new bills, cards, and loans.">
      <Section title="Add a bucket" subtitle="Name + target are enough to start. Add details if you want." />

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Name (e.g., Verizon, CPS Auto Loan)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />

          <input
            placeholder="Target (amount)"
            value={newTarget || ""}
            onChange={(e) => setNewTarget(Number(e.target.value))}
            style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Due label (optional) — e.g., ASAP / Feb 28"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value) as 1 | 2 | 3)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              <option value={1}>Priority 1</option>
              <option value={2}>Priority 2</option>
              <option value={3}>Priority 3</option>
            </select>

            <select
              value={newKind || "bill"}
              onChange={(e) => setNewKind(e.target.value as any)}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            >
              <option value="bill">Bill</option>
              <option value="credit">Credit</option>
              <option value="loan">Loan</option>
            </select>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
              <input type="checkbox" checked={newFocus} onChange={(e) => setNewFocus(e.target.checked)} />
              Focus
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Balance (optional)"
              value={newBalance || ""}
              onChange={(e) => setNewBalance(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
            <input
              placeholder="APR % (optional)"
              value={newApr || ""}
              onChange={(e) => setNewApr(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Min payment (optional)"
              value={newMinPayment || ""}
              onChange={(e) => setNewMinPayment(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
            <input
              placeholder="Credit limit (optional)"
              value={newCreditLimit || ""}
              onChange={(e) => setNewCreditLimit(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
            />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
            <input type="checkbox" checked={newIsMonthly} onChange={(e) => setNewIsMonthly(e.target.checked)} />
            Monthly bucket
          </label>

          {newIsMonthly ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Monthly target"
                value={newMonthlyTarget || ""}
                onChange={(e) => setNewMonthlyTarget(Number(e.target.value))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
              />
              <input
                placeholder="Due day (1-31)"
                value={newDueDay || ""}
                onChange={(e) => setNewDueDay(Number(e.target.value))}
                style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
              />
            </div>
          ) : null}

          <button onClick={addBucket} style={btn()}>
            Add Bucket
          </button>
        </div>

        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Tip: For cards/loans, set <b>Kind</b> to Credit/Loan and add a <b>Balance</b>. Allocations will reduce the balance (if your store does that).
        </div>
      </div>
    </MoneyShell>
  );
}
