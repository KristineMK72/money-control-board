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
  dueDate?: string;

  priority: 1 | 2 | 3;
  focus?: boolean;

  kind?: "bill" | "credit" | "loan";
  balance?: number;
  apr?: number;
  minPayment?: number;
  creditLimit?: number;

  isMonthly?: boolean;
  monthlyTarget?: number;
  dueDay?: number;
};

type Entry = {
  id: string;
  dateISO: string;
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

type StorageShape = {
  buckets: Bucket[];
  entries: Entry[];
  meta?: {
    lastMonthlyApplied?: string;
  };
};

const STORAGE_KEY = "money-control-board-v5";

/* =============================
   HELPERS
============================= */

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * 100) / 100;
  return Math.max(0, v);
}

function clampPercent(n: number) {
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

function monthKeyFromISO(iso: string) {
  return iso.slice(0, 7);
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function slugKey(name: string) {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "bucket";
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(iso: string) {
  // Monday start
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun..6 Sat
  const mondayOffset = (day + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(iso: string) {
  return addDaysISO(startOfWeekISO(iso), 6);
}

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function clampDayOfMonth(d: number) {
  if (!Number.isFinite(d)) return 1;
  return Math.min(31, Math.max(1, Math.floor(d)));
}

function dueDateForNextOccurrence(nowISO: string, dueDay: number) {
  const now = new Date(nowISO + "T00:00:00");
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const day = clampDayOfMonth(dueDay);

  if (today <= day) {
    const d = new Date(Date.UTC(y, m, day));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(Date.UTC(y, m + 1, day));
  return d.toISOString().slice(0, 10);
}

function applyMonthlyAutoAdd(nowISO: string, buckets: Bucket[]) {
  return buckets.map((b) => {
    if (!b.isMonthly) return b;
    const monthlyTarget = clampMoney(b.monthlyTarget ?? b.target);
    const dueDay = clampDayOfMonth(b.dueDay ?? 1);
    const dueDate = dueDateForNextOccurrence(nowISO, dueDay);

    return { ...b, target: monthlyTarget, dueDate };
  });
}

/* =============================
   UI HELPERS
============================= */

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

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.72, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
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
   PAGE
============================= */

export default function MoneyPage() {
  const now = todayISO();
  const nowMonthKey = monthKeyFromISO(now);

  const [buckets, setBuckets] = useState<Bucket[]>([
    { key: "car", name: "Car Repair", target: 300, saved: 0, due: "ASAP (safety + income)", priority: 1, focus: true, kind: "bill" },
    { key: "insurance", name: "Insurance", target: 124, saved: 0, dueDate: "2026-02-23", due: "before Feb 23", priority: 1, focus: true, kind: "bill" },
    { key: "power", name: "Crow Wing Power", target: 137, saved: 0, due: "ASAP", priority: 1, focus: true, kind: "bill" },
    { key: "collections", name: "$100 Before Collections", target: 100, saved: 0, due: "ASAP", priority: 1, focus: true, kind: "bill" },

    {
      key: "acct0928",
      name: "Card 0928 (Min Payment)",
      target: 55.57,
      saved: 0,
      priority: 1,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 55.57,
      dueDay: 6,
      balance: 602.31,
      minPayment: 55.57,
    },
    {
      key: "creditone",
      name: "Credit One (Min Payment)",
      target: 52,
      saved: 0,
      priority: 1,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 52,
      dueDay: 18,
      balance: 1028.22,
      minPayment: 52,
      due: "Over limit",
    },
    {
      key: "sparrow",
      name: "Sparrow (Min Payment)",
      target: 35,
      saved: 0,
      priority: 1,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 35,
      dueDay: 18,
      balance: 304.39,
      minPayment: 35,
      due: "Overlimit ~$4.39",
    },

    { key: "tsa", name: "TSA Temp 10-day", target: 45, saved: 0, due: "before Tues trip", priority: 2, focus: true, kind: "bill" },
    { key: "bill347", name: "Bill Due Mar 3", target: 347, saved: 0, dueDate: "2026-03-03", due: "Mar 3", priority: 2, focus: true, kind: "bill" },
    { key: "verizon", name: "Verizon (one-time spike)", target: 320, saved: 0, dueDate: "2026-02-28", due: "Feb 28", priority: 2, focus: true, kind: "bill" },
    { key: "varo", name: "Varo", target: 81, saved: 0, dueDate: "2026-02-28", due: "Feb 28", priority: 2, focus: true, kind: "bill" },

    {
      key: "capone",
      name: "Capital One (Min Payment)",
      target: 25,
      saved: 0,
      priority: 2,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 25,
      dueDay: 20,
      balance: 303.41,
      minPayment: 25,
    },
    {
      key: "indigo",
      name: "Indigo (Min Payment)",
      target: 40,
      saved: 0,
      priority: 2,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 40,
      dueDay: 22,
      balance: 494.64,
      minPayment: 40,
      due: "Over limit",
    },
    {
      key: "destiny",
      name: "Destiny (Min Payment)",
      target: 40,
      saved: 0,
      priority: 2,
      focus: true,
      kind: "credit",
      isMonthly: true,
      monthlyTarget: 40,
      dueDay: 22,
      balance: 234.35,
      minPayment: 40,
    },

    {
      key: "cpsloan",
      name: "CPS Auto Loan (Payment)",
      target: 632.03,
      saved: 0,
      priority: 1,
      focus: true,
      kind: "loan",
      isMonthly: true,
      monthlyTarget: 632.03,
      dueDay: 21,
      balance: 25484.53,
      minPayment: 632.03,
      due: "Past due shown (fees included)",
    },

    {
      key: "homechoice",
      name: "Home Choice (Monthly)",
      target: 347,
      saved: 0,
      priority: 2,
      focus: true,
      kind: "bill",
      isMonthly: true,
      monthlyTarget: 347,
      dueDay: 3,
      due: "Monthly until about Dec",
    },

    { key: "buffer", name: "Emergency Buffer", target: 500, saved: 0, due: "6-week goal", priority: 3, kind: "bill" },
    { key: "gas", name: "Gas / Daily Needs", target: 0, saved: 0, due: "rolling", priority: 3, kind: "bill" },
  ]);

  const [entries, setEntries] = useState<Entry[]>([]);

  const [entryDate, setEntryDate] = useState<string>(now);
  const [entrySource, setEntrySource] = useState<Entry["source"]>("Salon");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryNote, setEntryNote] = useState<string>("");

  const [allocKey, setAllocKey] = useState<BucketKey>("insurance");
  const [allocAmt, setAllocAmt] = useState<number>(0);

  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<number>(0);
  const [newDue, setNewDue] = useState("");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [newFocus, setNewFocus] = useState(true);

  const [newKind, setNewKind] = useState<Bucket["kind"]>("bill");
  const [newBalance, setNewBalance] = useState<number>(0);
  const [newApr, setNewApr] = useState<number>(0);
  const [newMinPayment, setNewMinPayment] = useState<number>(0);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(0);

  const [newIsMonthly, setNewIsMonthly] = useState<boolean>(false);
  const [newMonthlyTarget, setNewMonthlyTarget] = useState<number>(0);
  const [newDueDay, setNewDueDay] = useState<number>(1);

  /* ---------- Load / Save ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setBuckets((prev) => applyMonthlyAutoAdd(now, prev));
        return;
      }

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
    } catch {
      setBuckets((prev) => applyMonthlyAutoAdd(now, prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StorageShape;
      const last = parsed?.meta?.lastMonthlyApplied || "";
      if (last === nowMonthKey) return;

      setBuckets((prev) => {
        const next = applyMonthlyAutoAdd(now, prev);
        try {
          const payload: StorageShape = { buckets: next, entries: parsed.entries || [], meta: { lastMonthlyApplied: nowMonthKey } };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {}
        return next;
      });
    } catch {}
  }, [now, nowMonthKey]);

  /* ---------- Derived ---------- */

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

  function remaining(b: Bucket) {
    if (b.target <= 0) return 0;
    return clampMoney(Math.max(0, b.target - b.saved));
  }

  function recomputeBucketSaved(nextEntries: Entry[]) {
    const sums: Record<string, number> = {};
    for (const e of nextEntries) {
      for (const [k, v] of Object.entries(e.allocations || {})) {
        sums[k] = (sums[k] || 0) + (v || 0);
      }
    }
    setBuckets((prev) =>
      prev.map((b) => ({
        ...b,
        saved: clampMoney(sums[b.key] || 0),
      }))
    );
  }

  /* ---------- Actions ---------- */

  function addIncome() {
    const amt = clampMoney(entryAmount);
    if (amt <= 0) return;

    const newEntry: Entry = {
      id: uid(),
      dateISO: entryDate,
      source: entrySource,
      amount: amt,
      note: entryNote.trim() || undefined,
      allocations: {},
    };

    const next = [newEntry, ...entries].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    setEntries(next);
    setEntryAmount(0);
    setEntryNote("");
  }

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
  }

  function allocateUnassigned() {
    allocateAmount(allocKey, allocAmt);
    setAllocAmt(0);
  }

  function autoFundEssentials() {
    const order = buckets
      .slice()
      .sort((a, b) => {
        const af = a.focus ? 0 : 1;
        const bf = b.focus ? 0 : 1;
        if (af !== bf) return af - bf;
        return a.priority - b.priority;
      })
      .map((b) => b.key);

    let unassigned = totals.unassigned;
    if (unassigned <= 0) return;

    for (const k of order) {
      const b = bucketsByKey.get(k);
      if (!b || b.target <= 0) continue;

      const rem = remaining(b);
      if (rem <= 0) continue;

      const pay = clampMoney(Math.min(unassigned, rem));
      if (pay <= 0) continue;

      allocateAmount(k, pay);
      unassigned = clampMoney(unassigned - pay);
      if (unassigned <= 0) break;
    }
  }

  function updateBucket(key: BucketKey, patch: Partial<Bucket>) {
    setBuckets((prev) =>
      prev.map((b) =>
        b.key === key
          ? {
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
            }
          : b
      )
    );
  }

  function removeBucket(key: BucketKey) {
    const ok = confirm("Delete this bucket? (Existing allocations remain in history.)");
    if (!ok) return;
    setBuckets((prev) => prev.filter((b) => b.key !== key));
  }

  function addBucket() {
    const name = newName.trim();
    if (!name) return;

    const baseKey = slugKey(name);
    let key = baseKey;
    let i = 2;
    while (buckets.some((b) => b.key === key)) key = `${baseKey}-${i++}`;

    const isMonthly = !!newIsMonthly;

    const bucket: Bucket = {
      key,
      name,
      target: clampMoney(newTarget),
      saved: 0,
      due: newDue.trim() || undefined,
      dueDate: (newDueDate || "").trim() || "",
      priority: newPriority,
      focus: newFocus,

      kind: newKind,
      balance: newBalance ? clampMoney(newBalance) : undefined,
      apr: newApr ? clampPercent(newApr) : undefined,
      minPayment: newMinPayment ? clampMoney(newMinPayment) : undefined,
      creditLimit: newCreditLimit ? clampMoney(newCreditLimit) : undefined,

      isMonthly,
      monthlyTarget: isMonthly ? clampMoney(newMonthlyTarget || newTarget) : undefined,
      dueDay: isMonthly ? clampDayOfMonth(newDueDay) : undefined,
    };

    const nextBuckets = [bucket, ...buckets];
    const finalBuckets = bucket.isMonthly ? applyMonthlyAutoAdd(now, nextBuckets) : nextBuckets;

    setBuckets(finalBuckets);

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

  function resetAll() {
    const ok = confirm("Reset this board (entries + allocations) on this device?");
    if (!ok) return;
    setEntries([]);
    setBuckets((prev) => prev.map((b) => ({ ...b, saved: 0 })));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  /* ---------- Planning: Income Needed Each Week ---------- */

  const plan = useMemo(() => {
    const w1Start = startOfWeekISO(now);
    const w1End = endOfWeekISO(w1Start);
    const w2Start = addDaysISO(w1End, 1);
    const w2End = endOfWeekISO(w2Start);
    const w3Start = addDaysISO(w2End, 1);
    const w3End = endOfWeekISO(w3Start);
    const w4Start = addDaysISO(w3End, 1);
    const w4End = endOfWeekISO(w4Start);

    const dayHorizonEnd = addDaysISO(now, 7);

    const candidates = buckets
      .filter((b) => b.target > 0)
      .map((b) => ({
        b,
        rem: remaining(b),
        dueDate: (b.dueDate || "").trim() || undefined,
      }))
      .filter((x) => x.rem > 0);

    const inRange = (d: string, a: string, z: string) => d >= a && d <= z;
    const sum = (arr: typeof candidates) => clampMoney(arr.reduce((s, x) => s + x.rem, 0));

    const week1 = candidates.filter((x) => x.dueDate && inRange(x.dueDate, w1Start, w1End));
    const week2 = candidates.filter((x) => x.dueDate && inRange(x.dueDate, w2Start, w2End));
    const week3 = candidates.filter((x) => x.dueDate && inRange(x.dueDate, w3Start, w3End));
    const week4 = candidates.filter((x) => x.dueDate && inRange(x.dueDate, w4Start, w4End));

    const later = candidates.filter((x) => x.dueDate && x.dueDate > w4End);
    const unscheduled = candidates.filter((x) => !x.dueDate);

    const soon = candidates
      .filter((x) => x.dueDate && inRange(x.dueDate, now, dayHorizonEnd))
      .slice()
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));

    const dailyNeed = soon.map((x) => {
      const daysLeft = Math.max(0, daysBetween(now, x.dueDate!));
      const divisor = Math.max(1, daysLeft + 1);
      const perDay = clampMoney(x.rem / divisor);
      return { ...x, daysLeft, perDay };
    });

    const weeks = [
      { label: `Week 1 (${w1Start} → ${w1End})`, start: w1Start, end: w1End, total: sum(week1) },
      { label: `Week 2 (${w2Start} → ${w2End})`, start: w2Start, end: w2End, total: sum(week2) },
      { label: `Week 3 (${w3Start} → ${w3End})`, start: w3Start, end: w3End, total: sum(week3) },
      { label: `Week 4 (${w4Start} → ${w4End})`, start: w4Start, end: w4End, total: sum(week4) },
    ];

    const avg4 = clampMoney(weeks.reduce((s, w) => s + w.total, 0) / 4);

    return {
      w1Start,
      w1End,
      w2Start,
      w2End,
      totals: {
        week1: sum(week1),
        week2: sum(week2),
        later: sum(later),
        unscheduled: sum(unscheduled),
      },
      weeks,
      avg4,
      dailyNeed,
      bounds: { w1Start, w1End, w2Start, w2End, w3Start, w3End, w4Start, w4End },
    };
  }, [buckets, now]);

  const focusBuckets = useMemo(() => buckets.filter((b) => b.focus), [buckets]);
  const otherBuckets = useMemo(() => buckets.filter((b) => !b.focus), [buckets]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = byDate.get(e.dateISO) || [];
      arr.push(e);
      byDate.set(e.dateISO, arr);
    }
    const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
    return { byDate, dates };
  }, [entries]);

  function listForWeek(startISO: string, endISO: string) {
    return buckets
      .filter((b) => b.target > 0)
      .map((b) => ({ b, rem: remaining(b), dueDate: (b.dueDate || "").trim() }))
      .filter((x) => x.rem > 0 && x.dueDate && x.dueDate >= startISO && x.dueDate <= endISO)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  }

  function BucketCard({ bucket }: { bucket: Bucket }) {
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

  const week1Items = useMemo(() => listForWeek(plan.bounds.w1Start, plan.bounds.w1End), [buckets, plan.bounds.w1Start, plan.bounds.w1End]);
  const week2Items = useMemo(() => listForWeek(plan.bounds.w2Start, plan.bounds.w2End), [buckets, plan.bounds.w2Start, plan.bounds.w2End]);

    return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>
            Money Control Board
          </h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>
            Focus: <b>Now → March 7</b> · Fund buckets, not stress.
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/data" style={linkBtn()}>
              View /data (export/import)
            </a>
            <a href="/login" style={linkBtn()}>
              Cloud Mode (login)
            </a>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={autoFundEssentials} style={btn()}>
            Auto-Fund Essentials
          </button>
          <button onClick={resetAll} style={btn("danger")}>
            Reset
          </button>
        </div>
      </header>

      <div style={styles.summaryGrid}>
        <SummaryCard title="Income Logged" value={fmt(totals.income)} />
        <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
        <SummaryCard
          title="Unassigned"
          value={fmt(totals.unassigned)}
          hint="This is what you can allocate next."
        />
      </div>

      <Section
        title="Income Needed Each Week"
        subtitle="Remaining amount needed for buckets with due dates."
      />

      <div style={styles.weekStrip}>
        {plan.weeks.map((w) => (
          <div key={w.label} style={styles.weekCard}>
            <div style={{ fontSize: 13, opacity: 0.78, fontWeight: 900 }}>
              {w.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 8 }}>
              {fmt(w.total)}
            </div>
            <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
              Daily pace: <b>{fmt(w.total / 7)}</b>
            </div>
          </div>
        ))}
      </div>

      <Section title="Focused Buckets" />
      <div style={styles.bucketGrid}>
        {focusBuckets.map((b) => (
          <BucketCard key={b.key} bucket={b} />
        ))}
      </div>

      <Section title="Other Buckets" />
      <div style={styles.bucketGrid}>
        {otherBuckets.map((b) => (
          <BucketCard key={b.key} bucket={b} />
        ))}
      </div>

         <Section title="Log Income" />
      <div style={styles.formRow}>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          style={styles.input}
        />
        <select
          value={entrySource}
          onChange={(e) => setEntrySource(e.target.value as any)}
          style={styles.input}
        >
          <option>Salon</option>
          <option>DoorDash</option>
          <option>Other</option>
        </select>
        <input
          placeholder="Amount"
          value={entryAmount || ""}
          onChange={(e) => setEntryAmount(Number(e.target.value))}
          style={styles.input}
        />
        <button onClick={addIncome} style={btn()}>
          Add
        </button>
      </div>

      <Section title="Allocate Unassigned" />
      <div style={styles.allocRow}>
        <select
          value={allocKey}
          onChange={(e) => setAllocKey(e.target.value)}
          style={styles.input}
        >
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
        />
        <button onClick={allocateUnassigned} style={btn()}>
          Allocate
        </button>
      </div>

      <footer style={{ marginTop: 24, opacity: 0.7, fontSize: 13 }}>
        Tip: Set due dates for credit cards and loans to power weekly totals.
      </footer>
    </div>
  );
}

/* =============================
   STYLES
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: 14,
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
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
