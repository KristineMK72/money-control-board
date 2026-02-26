"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bucket, BucketKey, Entry, StorageShape } from "./types";
import {
  applyMonthlyAutoAdd,
  clampDayOfMonth,
  clampMoney,
  clampPercent,
  monthKeyFromISO,
  todayISO,
} from "./utils";

export const STORAGE_KEY = "money-control-board-v6";

function defaultBuckets(): Bucket[] {
  return [
    { key: "car", name: "Car Repair", target: 300, saved: 0, due: "ASAP (safety + income)", priority: 1, focus: true, kind: "bill" },
    { key: "insurance", name: "Insurance", target: 124, saved: 0, dueDate: "2026-02-23", due: "before Feb 23", priority: 1, focus: true, kind: "bill" },
    { key: "power", name: "Crow Wing Power", target: 137, saved: 0, due: "ASAP", priority: 1, focus: true, kind: "bill" },
    { key: "collections", name: "$100 Before Collections", target: 100, saved: 0, due: "ASAP", priority: 1, focus: true, kind: "bill" },

    { key: "acct0928", name: "Card 0928 (Min Payment)", target: 55.57, saved: 0, priority: 1, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 55.57, dueDay: 6, balance: 602.31, minPayment: 55.57 },
    { key: "creditone", name: "Credit One (Min Payment)", target: 52, saved: 0, priority: 1, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 52, dueDay: 18, balance: 1028.22, minPayment: 52, due: "Over limit" },
    { key: "sparrow", name: "Sparrow (Min Payment)", target: 35, saved: 0, priority: 1, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 35, dueDay: 18, balance: 304.39, minPayment: 35, due: "Overlimit ~$4.39" },

    { key: "tsa", name: "TSA Temp 10-day", target: 45, saved: 0, due: "before Tues trip", priority: 2, focus: true, kind: "bill" },
    { key: "verizon", name: "Verizon (one-time spike)", target: 320, saved: 0, dueDate: "2026-02-28", due: "Feb 28", priority: 2, focus: true, kind: "bill" },
    { key: "varo", name: "Varo", target: 81, saved: 0, dueDate: "2026-02-28", due: "Feb 28", priority: 2, focus: true, kind: "bill" },

    { key: "capone", name: "Capital One (Min Payment)", target: 25, saved: 0, priority: 2, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 25, dueDay: 20, balance: 303.41, minPayment: 25 },
    { key: "indigo", name: "Indigo (Min Payment)", target: 40, saved: 0, priority: 2, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 40, dueDay: 22, balance: 494.64, minPayment: 40, due: "Over limit" },
    { key: "destiny", name: "Destiny (Min Payment)", target: 40, saved: 0, priority: 2, focus: true, kind: "credit", isMonthly: true, monthlyTarget: 40, dueDay: 22, balance: 234.35, minPayment: 40 },

    { key: "cpsloan", name: "CPS Auto Loan (Payment)", target: 632.03, saved: 0, priority: 1, focus: true, kind: "loan", isMonthly: true, monthlyTarget: 632.03, dueDay: 21, balance: 25484.53, minPayment: 632.03, due: "Past due shown (fees included)" },

    { key: "homechoice", name: "Home Choice (Monthly)", target: 347, saved: 0, priority: 2, focus: true, kind: "bill", isMonthly: true, monthlyTarget: 347, dueDay: 3, due: "Monthly until about Dec" },

    { key: "buffer", name: "Emergency Buffer", target: 500, saved: 0, due: "6-week goal", priority: 3, focus: false, kind: "bill" },
    { key: "gas", name: "Gas / Daily Needs", target: 0, saved: 0, due: "rolling", priority: 3, focus: false, kind: "bill" },
  ];
}

export function useMoneyStore() {
  const now = todayISO();
  const nowMonthKey = monthKeyFromISO(now);

  const [buckets, setBuckets] = useState<Bucket[]>(() => applyMonthlyAutoAdd(now, defaultBuckets()));
  const [entries, setEntries] = useState<Entry[]>([]);

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as StorageShape;

      const loadedBuckets = (parsed?.buckets || []).map((b) => ({
        ...b,
        target: clampMoney(b.target),
        saved: clampMoney(b.saved),
        balance: b.balance == null ? undefined : clampMoney(b.balance),
        apr: b.apr == null ? undefined : clampPercent(b.apr),
        minPayment: b.minPayment == null ? undefined : clampMoney(b.minPayment),
        creditLimit: b.creditLimit == null ? undefined : clampMoney(b.creditLimit),
        monthlyTarget: b.monthlyTarget == null ? undefined : clampMoney(b.monthlyTarget),
        dueDay: b.dueDay == null ? undefined : clampDayOfMonth(b.dueDay),
        dueDate: (b.dueDate || "").trim() || "",
        isMonthly: !!b.isMonthly,
        focus: !!b.focus,
        kind: b.kind || "bill",
      }));

      const last = parsed?.meta?.lastMonthlyApplied || "";
      const shouldApply = last !== monthKeyFromISO(now);
      const fixedBuckets = shouldApply ? applyMonthlyAutoAdd(now, loadedBuckets) : loadedBuckets;

      setBuckets(fixedBuckets);
      setEntries(parsed?.entries || []);

      if (shouldApply) {
        const nextStore: StorageShape = {
          buckets: fixedBuckets,
          entries: parsed?.entries || [],
          meta: { lastMonthlyApplied: monthKeyFromISO(now) },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // save
  useEffect(() => {
    try {
      const payload: StorageShape = {
        buckets,
        entries,
        meta: { lastMonthlyApplied: nowMonthKey },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [buckets, entries, nowMonthKey]);

  const totals = useMemo(() => {
    const income = entries.reduce((s, e) => s + (e.amount || 0), 0);
    const allocated = entries.reduce((s, e) => {
      const a = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
      return s + a;
    }, 0);
    const unassigned = clampMoney(income - allocated);
    return { income: clampMoney(income), allocated: clampMoney(allocated), unassigned };
  }, [entries]);

  const bucketsByKey = useMemo(() => {
    const m = new Map<BucketKey, Bucket>();
    buckets.forEach((b) => m.set(b.key, b));
    return m;
  }, [buckets]);

  function recomputeBucketSaved(nextEntries: Entry[]) {
    const sums: Record<string, number> = {};
    for (const e of nextEntries) {
      for (const [k, v] of Object.entries(e.allocations || {})) {
        sums[k] = (sums[k] || 0) + (v || 0);
      }
    }
    setBuckets((prev) => prev.map((b) => ({ ...b, saved: clampMoney(sums[b.key] || 0) })));
  }

  function addIncome(params: { dateISO: string; source: Entry["source"]; amount: number; note?: string }) {
    const amt = clampMoney(params.amount);
    if (amt <= 0) return;

    const newEntry: Entry = {
      id: Math.random().toString(16).slice(2) + "-" + Date.now().toString(16),
      dateISO: params.dateISO,
      source: params.source,
      amount: amt,
      note: params.note?.trim() || undefined,
      allocations: {},
    };

    const next = [newEntry, ...entries].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    setEntries(next);
  }

  // ✅ Allocate + recompute saved + also reduce balance for credit/loan
  function allocateAmount(key: BucketKey, amount: number) {
    const amt = clampMoney(amount);
    if (amt <= 0) return;
    if (totals.unassigned < amt) return;

    const nextEntries = [...entries];
    let remainingToAllocate = amt;

    for (const e of nextEntries) {
      const allocatedInEntry = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
      const room = clampMoney(e.amount - allocatedInEntry);
      if (room <= 0) continue;

      const take = clampMoney(Math.min(room, remainingToAllocate));
      e.allocations = { ...(e.allocations || {}) };
      e.allocations[key] = clampMoney((e.allocations[key] || 0) + take);

      remainingToAllocate = clampMoney(remainingToAllocate - take);
      if (remainingToAllocate <= 0) break;
    }

    if (remainingToAllocate > 0) return;

    setEntries(nextEntries);
    recomputeBucketSaved(nextEntries);

    setBuckets((prev) =>
      prev.map((b) => {
        if (b.key !== key) return b;
        if (b.kind !== "credit" && b.kind !== "loan") return b;
        if (b.balance == null) return b;
        return { ...b, balance: clampMoney(Math.max(0, b.balance - amt)) };
      })
    );
  }

  function updateBucket(key: BucketKey, patch: Partial<Bucket>) {
    setBuckets((prev) =>
      prev.map((b) =>
        b.key !== key
          ? b
          : {
              ...b,
              ...patch,
              target: clampMoney(patch.target ?? b.target),
              saved: clampMoney(patch.saved ?? b.saved),
              balance: patch.balance == null ? b.balance : clampMoney(patch.balance),
              apr: patch.apr == null ? b.apr : clampPercent(patch.apr),
              minPayment: patch.minPayment == null ? b.minPayment : clampMoney(patch.minPayment),
              creditLimit: patch.creditLimit == null ? b.creditLimit : clampMoney(patch.creditLimit),
              monthlyTarget: patch.monthlyTarget == null ? b.monthlyTarget : clampMoney(patch.monthlyTarget),
              dueDay: patch.dueDay == null ? b.dueDay : clampDayOfMonth(patch.dueDay),
              isMonthly: patch.isMonthly == null ? b.isMonthly : !!patch.isMonthly,
              dueDate: patch.dueDate == null ? b.dueDate : (patch.dueDate || "").trim(),
              focus: patch.focus == null ? b.focus : !!patch.focus,
              kind: (patch.kind ?? b.kind) as any,
            }
      )
    );
  }

  function addBucket(bucket: Bucket) {
    setBuckets((prev) => applyMonthlyAutoAdd(now, [bucket, ...prev]));
  }

  function removeBucket(key: BucketKey) {
    setBuckets((prev) => prev.filter((b) => b.key !== key));
  }

  function resetAll() {
    setEntries([]);
    setBuckets(applyMonthlyAutoAdd(now, defaultBuckets()).map((b) => ({ ...b, saved: 0 })));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  return {
    now,
    buckets,
    entries,
    totals,
    bucketsByKey,
    addIncome,
    allocateAmount,
    updateBucket,
    addBucket,
    removeBucket,
    resetAll,
  };
}
