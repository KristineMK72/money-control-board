"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Bucket, BucketKey, Entry, SpendEntry, SpendCategory, StorageShape } from "./types";
import {
  applyMonthlyAutoAdd,
  clampDayOfMonth,
  clampMoney,
  clampPercent,
  monthKeyFromISO,
  todayISO,
} from "./utils";

export const STORAGE_KEY = "money-control-board-v6";

/* =============================
   DEFAULTS
============================= */

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

/* =============================
   NORMALIZE (when loading)
============================= */

function normalizeBuckets(list: Bucket[]): Bucket[] {
  return (list || []).map((b) => ({
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
    kind: (b.kind || "bill") as any,
  }));
}

function computeTotals(entries: Entry[]) {
  const income = entries.reduce((s, e) => s + (e.amount || 0), 0);
  const allocated = entries.reduce((s, e) => {
    const a = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
    return s + a;
  }, 0);
  const unassigned = clampMoney(income - allocated);
  return { income: clampMoney(income), allocated: clampMoney(allocated), unassigned };
}

function recomputeSavedFromEntries(buckets: Bucket[], entries: Entry[]) {
  const sums: Record<string, number> = {};
  for (const e of entries) {
    for (const [k, v] of Object.entries(e.allocations || {})) {
      sums[k] = (sums[k] || 0) + (v || 0);
    }
  }
  return buckets.map((b) => ({ ...b, saved: clampMoney(sums[b.key] || 0) }));
}

/* =============================
   ZUSTAND STATE
============================= */

type MoneyState = {
  now: string;

  buckets: Bucket[];
  entries: Entry[];
  spend: SpendEntry[];

  totals: { income: number; allocated: number; unassigned: number };
  bucketsByKey: Map<BucketKey, Bucket>;

  addIncome: (params: { dateISO: string; source: Entry["source"]; amount: number; note?: string }) => void;

  addSpend: (params: { dateISO?: string; amount: number; category: SpendCategory; note?: string }) => void;
  removeSpend: (id: string) => void;

  allocateAmount: (key: BucketKey, amount: number) => void;

  addBucket: (bucket: Bucket) => void;
  updateBucket: (key: BucketKey, patch: Partial<Bucket>) => void;
  removeBucket: (key: BucketKey) => void;
  deleteBucket: (key: BucketKey) => void; // alias

  resetAll: () => void;
};

export const useMoneyStore = create<MoneyState>()(
  persist(
    (set, get) => {
      const now = todayISO();
      const nowMonthKey = monthKeyFromISO(now);

      // start with defaults
      const initialBuckets = applyMonthlyAutoAdd(now, defaultBuckets());

      return {
        now,

        buckets: initialBuckets,
        entries: [],
        spend: [],

        totals: computeTotals([]),
        bucketsByKey: new Map(initialBuckets.map((b) => [b.key, b])),

        addIncome: (params) => {
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

          set((s) => {
            const nextEntries = [newEntry, ...s.entries].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
            const totals = computeTotals(nextEntries);
            return { entries: nextEntries, totals };
          });
        },

        addSpend: (params) => {
          const amt = clampMoney(params.amount);
          if (amt <= 0) return;

          const entry: SpendEntry = {
            id: Math.random().toString(16).slice(2) + "-" + Date.now().toString(16),
            dateISO: (params.dateISO || todayISO()).trim(),
            amount: amt,
            category: params.category,
            note: params.note?.trim() || undefined,
          };

          set((s) => {
            const next = [entry, ...s.spend].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
            return { spend: next };
          });
        },

        removeSpend: (id) => set((s) => ({ spend: s.spend.filter((x) => x.id !== id) })),

        allocateAmount: (key, amount) => {
          const amt = clampMoney(amount);
          if (amt <= 0) return;

          const { totals } = get();
          if (totals.unassigned < amt) return;

          set((s) => {
            const nextEntries = [...s.entries];
            let remaining = amt;

            for (const e of nextEntries) {
              const allocatedInEntry = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
              const room = clampMoney(e.amount - allocatedInEntry);
              if (room <= 0) continue;

              const take = clampMoney(Math.min(room, remaining));
              e.allocations = { ...(e.allocations || {}) };
              e.allocations[key] = clampMoney((e.allocations[key] || 0) + take);

              remaining = clampMoney(remaining - take);
              if (remaining <= 0) break;
            }

            if (remaining > 0) return s;

            // recompute saved
            let nextBuckets = recomputeSavedFromEntries(s.buckets, nextEntries);

            // reduce balance for credit/loan
            nextBuckets = nextBuckets.map((b) => {
              if (b.key !== key) return b;
              if (b.kind !== "credit" && b.kind !== "loan") return b;
              if (b.balance == null) return b;
              return { ...b, balance: clampMoney(Math.max(0, b.balance - amt)) };
            });

            const totals2 = computeTotals(nextEntries);
            const bucketsByKey = new Map(nextBuckets.map((b) => [b.key, b]));

            return { entries: nextEntries, buckets: nextBuckets, totals: totals2, bucketsByKey };
          });
        },

        addBucket: (bucket) => {
          set((s) => {
            const nextBuckets = applyMonthlyAutoAdd(now, [bucket, ...s.buckets]);
            const bucketsByKey = new Map(nextBuckets.map((b) => [b.key, b]));
            return { buckets: nextBuckets, bucketsByKey };
          });
        },

        updateBucket: (key, patch) => {
          set((s) => {
            const nextBuckets = s.buckets.map((b) => {
              if (b.key !== key) return b;
              return {
                ...b,
                ...patch,
                key, // key stays stable
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
              };
            });

            const bucketsByKey = new Map(nextBuckets.map((b) => [b.key, b]));
            return { buckets: nextBuckets, bucketsByKey };
          });
        },

        removeBucket: (key) => {
          set((s) => {
            const nextBuckets = s.buckets.filter((b) => b.key !== key);
            const bucketsByKey = new Map(nextBuckets.map((b) => [b.key, b]));
            return { buckets: nextBuckets, bucketsByKey };
          });
        },

        deleteBucket: (key) => get().removeBucket(key),

        resetAll: () => {
          const now = todayISO();
          const resetBuckets = applyMonthlyAutoAdd(now, defaultBuckets()).map((b) => ({ ...b, saved: 0 }));
          set({
            now,
            buckets: resetBuckets,
            entries: [],
            spend: [],
            totals: computeTotals([]),
            bucketsByKey: new Map(resetBuckets.map((b) => [b.key, b])),
          });
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),

      // ✅ migrate/normalize & apply monthly on load
      onRehydrateStorage: () => (state) => {
        try {
          if (!state) return;

          const now = todayISO();
          const nowMonthKey = monthKeyFromISO(now);

          // normalize stored buckets
          const loadedBuckets = normalizeBuckets(state.buckets || []);
          const loadedEntries = state.entries || [];

          // monthly apply once per month
          const raw = localStorage.getItem(STORAGE_KEY);
          let lastApplied = "";
          try {
            const parsed = raw ? (JSON.parse(raw) as StorageShape) : null;
            lastApplied = parsed?.meta?.lastMonthlyApplied || "";
          } catch {}

          const shouldApply = lastApplied !== nowMonthKey;
          const bucketsAfterMonthly = shouldApply ? applyMonthlyAutoAdd(now, loadedBuckets) : loadedBuckets;

          // saved should match allocations
          const bucketsWithSaved = recomputeSavedFromEntries(bucketsAfterMonthly, loadedEntries);

          state.now = now;
          state.buckets = bucketsWithSaved;
          state.totals = computeTotals(loadedEntries);
          state.bucketsByKey = new Map(bucketsWithSaved.map((b) => [b.key, b]));
        } catch {}
      },
      partialize: (s) => ({
        now: s.now,
        buckets: s.buckets,
        entries: s.entries,
        spend: s.spend,
        // keep a meta in the persisted shape
        meta: { lastMonthlyApplied: monthKeyFromISO(todayISO()) },
      }) as any,
    }
  )
);
