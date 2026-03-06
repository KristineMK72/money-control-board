"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextDueDateFromDay(day: number, fromISO = todayISO()) {
  const dueDay = clampDayOfMonth(day);
  const d = new Date(fromISO + "T00:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();

  const thisMonthLastDay = new Date(year, month + 1, 0).getDate();
  const thisMonthDue = Math.min(dueDay, thisMonthLastDay);
  const thisMonthCandidate = new Date(year, month, thisMonthDue);

  const today = new Date(fromISO + "T00:00:00");
  if (thisMonthCandidate >= today) {
    return thisMonthCandidate.toISOString().slice(0, 10);
  }

  const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
  const nextMonthDue = Math.min(dueDay, nextMonthLastDay);
  const nextMonthCandidate = new Date(year, month + 1, nextMonthDue);
  return nextMonthCandidate.toISOString().slice(0, 10);
}

/* =============================
   STYLES
============================= */

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#ffffff",
  color: "#111827",
  caretColor: "#111827",
  width: "100%",
};

const helpTextStyle: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 13,
};

/* =============================
   PAGE
============================= */

export default function AddEditPage() {
  const store = useMoneyStore();

  // ---- form state (used for both Add + Edit)
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

  // ---- editing
  const [editKey, setEditKey] = useState<BucketKey | "">("");

  const existingKeys = useMemo(
    () => new Set(store.buckets.map((b) => b.key)),
    [store.buckets]
  );

  const editBucket = useMemo(
    () => store.buckets.find((b) => b.key === editKey),
    [store.buckets, editKey]
  );

  function resetForm() {
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

  // Load selected bucket into form
  useEffect(() => {
    if (!editBucket) return;

    setNewName(editBucket.name ?? "");
    setNewTarget(Number(editBucket.target ?? 0));
    setNewDue(editBucket.due ?? "");
    setNewDueDate((editBucket as any).dueDate ?? "");

    setNewPriority((editBucket.priority ?? 2) as 1 | 2 | 3);
    setNewFocus(!!editBucket.focus);

    setNewKind((editBucket.kind ?? "bill") as Bucket["kind"]);
    setNewBalance(Number((editBucket as any).balance ?? 0));
    setNewApr(Number((editBucket as any).apr ?? 0));
    setNewMinPayment(Number((editBucket as any).minPayment ?? 0));
    setNewCreditLimit(Number((editBucket as any).creditLimit ?? 0));

    setNewIsMonthly(!!(editBucket as any).isMonthly);
    setNewMonthlyTarget(Number((editBucket as any).monthlyTarget ?? 0));
    setNewDueDay(Number((editBucket as any).dueDay ?? 1));
  }, [editBucket]);

  function buildBucketPatch(): Partial<Bucket> {
    const name = newName.trim();
    const isMonthly = !!newIsMonthly;
    const dueDay = isMonthly ? clampDayOfMonth(Number(newDueDay || 1)) : undefined;

    // If monthly + due day exists and user left dueDate blank,
    // auto-compute the next upcoming due date.
    const normalizedDueDate =
      (newDueDate || "").trim() ||
      (isMonthly && dueDay ? nextDueDateFromDay(dueDay) : "");

    return {
      name: name || undefined,

      target: Number(newTarget || 0),

      due: (newDue || "").trim() || undefined,
      dueDate: normalizedDueDate || undefined,

      priority: newPriority,
      focus: newFocus,

      kind: newKind,
      balance: newBalance ? Number(newBalance) : undefined,
      apr: newApr ? Number(newApr) : undefined,
      minPayment: newMinPayment ? Number(newMinPayment) : undefined,
      creditLimit: newCreditLimit ? Number(newCreditLimit) : undefined,

      isMonthly,
      monthlyTarget: isMonthly ? Number(newMonthlyTarget || newTarget || 0) : undefined,
      dueDay,
    } as any;
  }

  function addBucket() {
    const name = newName.trim();
    if (!name) return;

    const base = slugKey(name);
    let key: BucketKey = base;
    let i = 2;
    while (existingKeys.has(key)) {
      key = `${base}-${i++}` as BucketKey;
    }

    const patch = buildBucketPatch();

    const bucket: Bucket = {
      key,
      saved: 0,
      ...(patch as any),
      name,
    };

    store.addBucket(bucket);
    resetForm();
  }

  function saveEdits() {
    if (!editKey) return;
    const name = newName.trim();
    if (!name) return;

    store.updateBucket(editKey as BucketKey, buildBucketPatch());
  }

  function deleteSelected() {
    if (!editKey) return;

    const b = store.buckets.find((x) => x.key === editKey);
    const ok = window.confirm(
      `Delete bucket "${b?.name ?? editKey}"? This cannot be undone.`
    );
    if (!ok) return;

    store.deleteBucket(editKey as BucketKey);
    setEditKey("");
    resetForm();
  }

  return (
    <MoneyShell title="Add / Edit" subtitle="Create new bills, cards, and loans.">
      <Section
        title="Edit or delete a bucket"
        subtitle="Select a bucket to load it into the form, then save changes or delete."
      />

      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        <select
          value={editKey}
          onChange={(e) => setEditKey(e.target.value as any)}
          style={inputStyle}
        >
          <option value="">— Select a bucket —</option>
          {store.buckets
            .slice()
            .sort(
              (a, b) =>
                (a.priority ?? 2) - (b.priority ?? 2) ||
                a.name.localeCompare(b.name)
            )
            .map((b) => (
              <option key={b.key} value={b.key}>
                {b.name} ({b.key})
              </option>
            ))}
        </select>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={saveEdits}
            disabled={!editKey}
            style={btn(editKey ? "primary" : "default")}
          >
            Save Changes
          </button>

          <button
            onClick={deleteSelected}
            disabled={!editKey}
            style={btn(editKey ? "danger" : "default")}
          >
            Delete Bucket
          </button>

          <button
            onClick={() => {
              setEditKey("");
              resetForm();
            }}
            style={btn()}
          >
            Clear / New
          </button>
        </div>

        <div style={helpTextStyle}>
          Tip: Bucket <b>key</b> stays stable. If you need renaming keys, do it as
          “duplicate + delete old” (safer if entries reference bucket keys).
        </div>
      </div>

      <Section
        title="Add a bucket"
        subtitle="Name + target are enough to start. Add details if you want."
      />

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="Name (e.g., Verizon, CPS Auto Loan)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Target (amount)"
            value={newTarget || ""}
            onChange={(e) => setNewTarget(Number(e.target.value))}
            style={inputStyle}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Due label (optional) — e.g., ASAP / Feb 28"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              style={inputStyle}
            />
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(Number(e.target.value) as 1 | 2 | 3)}
              style={inputStyle}
            >
              <option value={1}>Priority 1</option>
              <option value={2}>Priority 2</option>
              <option value={3}>Priority 3</option>
            </select>

            <select
              value={newKind || "bill"}
              onChange={(e) => setNewKind(e.target.value as any)}
              style={inputStyle}
            >
              <option value="bill">Bill</option>
              <option value="credit">Credit</option>
              <option value="loan">Loan</option>
            </select>

            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontWeight: 800,
              }}
            >
              <input
                type="checkbox"
                checked={newFocus}
                onChange={(e) => setNewFocus(e.target.checked)}
              />
              Focus
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Balance (optional)"
              value={newBalance || ""}
              onChange={(e) => setNewBalance(Number(e.target.value))}
              style={inputStyle}
            />
            <input
              placeholder="APR % (optional)"
              value={newApr || ""}
              onChange={(e) => setNewApr(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              placeholder="Min payment (optional)"
              value={newMinPayment || ""}
              onChange={(e) => setNewMinPayment(Number(e.target.value))}
              style={inputStyle}
            />
            <input
              placeholder="Credit limit (optional)"
              value={newCreditLimit || ""}
              onChange={(e) => setNewCreditLimit(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontWeight: 800,
            }}
          >
            <input
              type="checkbox"
              checked={newIsMonthly}
              onChange={(e) => setNewIsMonthly(e.target.checked)}
            />
            Monthly bucket
          </label>

          {newIsMonthly ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                placeholder="Monthly target"
                value={newMonthlyTarget || ""}
                onChange={(e) => setNewMonthlyTarget(Number(e.target.value))}
                style={inputStyle}
              />
              <input
                placeholder="Due day (1-31)"
                value={newDueDay || ""}
                onChange={(e) => setNewDueDay(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          ) : null}

          <button onClick={addBucket} style={btn()}>
            Add Bucket
          </button>
        </div>

        <div style={helpTextStyle}>
          Tip: For cards/loans, set <b>Kind</b> to Credit/Loan, add a <b>Balance</b>,
          and for monthly payments set <b>Due day</b>. If you leave <b>Due date</b> blank,
          the app will auto-fill the next upcoming date from the due day.
        </div>
      </div>
    </MoneyShell>
  );
}
