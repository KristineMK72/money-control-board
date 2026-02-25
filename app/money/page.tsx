"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =============================
   TYPES
============================= */

type BucketKey = string;

type Bucket = {
  key: BucketKey;
  name: string;

  target: number; // goal amount (used by planner + remaining math)
  saved: number; // allocated so far (computed from entries allocations)

  dueDate?: string; // YYYY-MM-DD (optional)
  due?: string; // human note (optional)

  priority: 1 | 2 | 3; // 1 must, 2 important, 3 later
  focus?: boolean; // show in "Now → Mar 7"

  // ✅ NEW (optional) credit/loan fields
  balance?: number; // current balance (for display only)
  apr?: number; // APR % (for display only)

  // ✅ NEW (optional) monthly auto-add fields (credit cards / loans)
  isMonthly?: boolean; // if true, bucket auto-updates each month
  monthlyTarget?: number; // what target becomes each month
  dueDay?: number; // day of month (1-31) used to auto-set dueDate
};

type Entry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

type StorageShape = {
  buckets: Bucket[];
  entries: Entry[];
  meta?: {
    lastMonthlyApplied?: string; // YYYY-MM (e.g., "2026-03")
  };
};

const STORAGE_KEY = "money-control-board-v4";

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
  // iso = YYYY-MM-DD -> YYYY-MM
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
  // Sets due date to this month on dueDay if not passed; else next month on dueDay.
  const now = new Date(nowISO + "T00:00:00");
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  const today = now.getDate();

  const day = clampDayOfMonth(dueDay);

  // candidate this month
  if (today <= day) {
    const d = new Date(Date.UTC(y, m, day));
    return d.toISOString().slice(0, 10);
  }

  // next month
  const d = new Date(Date.UTC(y, m + 1, day));
  return d.toISOString().slice(0, 10);
}

/**
 * ✅ Monthly auto-add:
 * If bucket.isMonthly is true, each new month:
 * - bucket.target becomes bucket.monthlyTarget (>=0)
 * - bucket.dueDate becomes next occurrence of bucket.dueDay
 * - bucket.saved is NOT changed
 */
function applyMonthlyAutoAdd(nowISO: string, buckets: Bucket[]) {
  const updated = buckets.map((b) => {
    if (!b.isMonthly) return b;

    const monthlyTarget = clampMoney(b.monthlyTarget ?? b.target);
    const dueDay = clampDayOfMonth(b.dueDay ?? 1);
    const dueDate = dueDateForNextOccurrence(nowISO, dueDay);

    return {
      ...b,
      target: monthlyTarget,
      dueDate,
      // leave saved alone
    };
  });

  return updated;
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
        opacity: 0.9,
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
    // Priority 1 (must)
    { key: "car", name: "Car Repair", target: 300, saved: 0, due: "ASAP (safety + income)", priority: 1, focus: true },
    { key: "insurance", name: "Insurance", target: 124, saved: 0, due: "before Feb 23", priority: 1, focus: true, dueDate: "2026-02-23" },
    { key: "power", name: "Crow Wing Power", target: 137, saved: 0, due: "ASAP", priority: 1, focus: true },
    { key: "collections", name: "$100 Before Collections", target: 100, saved: 0, due: "ASAP", priority: 1, focus: true },

    // Priority 2
    { key: "tsa", name: "TSA Temp 10-day", target: 45, saved: 0, due: "before Tues trip", priority: 2, focus: true },
    { key: "bill347", name: "Bill Due Mar 3", target: 347, saved: 0, due: "Mar 3", priority: 2, focus: true, dueDate: "2026-03-03" },
    { key: "cps", name: "CPS (negotiate / partial)", target: 632, saved: 0, due: "call Sunday", priority: 2, focus: true },
    { key: "verizon", name: "Verizon (one-time spike)", target: 320, saved: 0, due: "Feb 28", priority: 2, focus: true, dueDate: "2026-02-28" },
    { key: "varo", name: "Varo", target: 81, saved: 0, due: "Feb 28", priority: 2, focus: true, dueDate: "2026-02-28" },

    // Priority 3
    { key: "deb", name: "Deb (owed)", target: 500, saved: 0, due: "structured", priority: 3 },
    { key: "buffer", name: "Emergency Buffer", target: 500, saved: 0, due: "6-week goal", priority: 3 },
    { key: "gas", name: "Gas / Daily Needs", target: 0, saved: 0, due: "rolling", priority: 3 },

    // ✅ Example monthly credit buckets (optional — you can delete or edit these)
    // { key: "sparrow", name: "Sparrow (Min Payment)", target: 35, saved: 0, priority: 2, focus: true, isMonthly: true, monthlyTarget: 35, dueDay: 18, balance: 304.39, apr: 0 },
  ]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryDate, setEntryDate] = useState<string>(now);
  const [entrySource, setEntrySource] = useState<Entry["source"]>("Salon");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryNote, setEntryNote] = useState<string>("");

  const [allocKey, setAllocKey] = useState<BucketKey>("insurance");
  const [allocAmt, setAllocAmt] = useState<number>(0);

  // Manage Buckets form
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<number>(0);
  const [newDue, setNewDue] = useState("");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [newFocus, setNewFocus] = useState(true);

  // ✅ NEW manage fields
  const [newBalance, setNewBalance] = useState<number>(0);
  const [newApr, setNewApr] = useState<number>(0);
  const [newIsMonthly, setNewIsMonthly] = useState<boolean>(false);
  const [newMonthlyTarget, setNewMonthlyTarget] = useState<number>(0);
  const [newDueDay, setNewDueDay] = useState<number>(1);

  /* ---------- Load / Save ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StorageShape;

      if (parsed?.buckets?.length) {
        const fixed = parsed.buckets.map((b) => ({
          ...b,
          target: clampMoney(b.target),
          saved: clampMoney(b.saved),
          balance: b.balance == null ? undefined : clampMoney(b.balance),
          apr: b.apr == null ? undefined : clampPercent(b.apr),
          monthlyTarget: b.monthlyTarget == null ? undefined : clampMoney(b.monthlyTarget),
          dueDay: b.dueDay == null ? undefined : clampDayOfMonth(b.dueDay),
          dueDate: (b as any).dueDate ?? "",
          isMonthly: !!b.isMonthly,
        }));

        // ✅ Apply monthly auto-add only once per month (idempotent)
        const last = parsed?.meta?.lastMonthlyApplied || "";
        const shouldApply = last !== monthKeyFromISO(todayISO());
        const maybeUpdated = shouldApply ? applyMonthlyAutoAdd(todayISO(), fixed) : fixed;

        setBuckets(maybeUpdated);
        if (shouldApply) {
          const nextStore: StorageShape = { buckets: maybeUpdated, entries: parsed.entries || [], meta: { lastMonthlyApplied: monthKeyFromISO(todayISO()) } };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
        }
      }

      if (parsed?.entries?.length) setEntries(parsed.entries);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const payload: StorageShape = {
        buckets,
        entries,
        meta: {
          lastMonthlyApplied: nowMonthKey,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [buckets, entries, nowMonthKey]);

  // ✅ Also ensure the “monthly apply” happens if the app stays open across months
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
    } catch {
      // ignore
    }
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
              monthlyTarget: patch.monthlyTarget == null ? b.monthlyTarget : clampMoney(patch.monthlyTarget),
              dueDay: patch.dueDay == null ? b.dueDay : clampDayOfMonth(patch.dueDay),
              isMonthly: patch.isMonthly == null ? b.isMonthly : !!patch.isMonthly,
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
      dueDate: newDueDate || "",
      priority: newPriority,
      focus: newFocus,

      // ✅ NEW
      balance: newBalance ? clampMoney(newBalance) : undefined,
      apr: newApr ? clampPercent(newApr) : undefined,
      isMonthly,
      monthlyTarget: isMonthly ? clampMoney(newMonthlyTarget || newTarget) : undefined,
      dueDay: isMonthly ? clampDayOfMonth(newDueDay) : undefined,
    };

    const nextBuckets = [bucket, ...buckets];

    // If it’s monthly, snap dueDate to the correct next occurrence immediately
    const finalBuckets = bucket.isMonthly ? applyMonthlyAutoAdd(now, nextBuckets) : nextBuckets;

    setBuckets(finalBuckets);

    setNewName("");
    setNewTarget(0);
    setNewDue("");
    setNewDueDate("");
    setNewPriority(2);
    setNewFocus(true);

    // ✅ reset new fields
    setNewBalance(0);
    setNewApr(0);
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

  /* ---------- Planning (weekly + daily + 4-week goal) ---------- */

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
  }, [buckets, now]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const rows = buckets
      .filter((b) => b.target > 0)
      .map((b) => ({
        b,
        rem: remaining(b),
        dueDate: (b.dueDate || "").trim(),
      }))
      .filter((x) => x.rem > 0 && x.dueDate && x.dueDate >= startISO && x.dueDate <= endISO)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    return rows;
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

    return (
      <div style={styles.panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950 }}>
            {bucket.name}{" "}
            <span style={{ fontWeight: 800, opacity: 0.65 }}>
              · P{bucket.priority} · {dueLabel}
              {bucket.isMonthly ? " · Monthly" : ""}
            </span>

            {/* ✅ NEW badges */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bucket.balance != null ? <Badge>Balance: {fmt(bucket.balance)}</Badge> : null}
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

  // ✅ PART 1 ends here.   return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Money Control Board</h1>
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
        <SummaryCard title="Unassigned" value={fmt(totals.unassigned)} hint="This is what you can allocate next." />
      </div>

      <Section
        title="Weekly Plan (Remaining Needed)"
        subtitle="Powered by due dates. If a bucket has no due date, it shows up in Unscheduled."
      />

      <div style={styles.weekGrid}>
        <div style={styles.panel}>
          <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>
            This Week ({plan.w1Start} → {plan.w1End})
          </div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>{fmt(plan.totals.week1)}</div>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {week1Items.length === 0 ? (
              <div style={{ opacity: 0.72, fontSize: 13 }}>No due dates set for this week.</div>
            ) : (
              week1Items.slice(0, 5).map((x) => (
                <div key={x.b.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <div style={{ opacity: 0.88 }}>
                    {x.b.name} <span style={{ opacity: 0.65 }}>· {x.dueDate}</span>
                  </div>
                  <div style={{ fontWeight: 900 }}>{fmt(x.rem)}</div>
                </div>
              ))
            )}
            {week1Items.length > 5 ? <div style={{ opacity: 0.72, fontSize: 12 }}>+ {week1Items.length - 5} more…</div> : null}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>
            Next Week ({plan.w2Start} → {plan.w2End})
          </div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>{fmt(plan.totals.week2)}</div>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {week2Items.length === 0 ? (
              <div style={{ opacity: 0.72, fontSize: 13 }}>No due dates set for next week.</div>
            ) : (
              week2Items.slice(0, 5).map((x) => (
                <div key={x.b.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <div style={{ opacity: 0.88 }}>
                    {x.b.name} <span style={{ opacity: 0.65 }}>· {x.dueDate}</span>
                  </div>
                  <div style={{ fontWeight: 900 }}>{fmt(x.rem)}</div>
                </div>
              ))
            )}
            {week2Items.length > 5 ? <div style={{ opacity: 0.72, fontSize: 12 }}>+ {week2Items.length - 5} more…</div> : null}
          </div>
        </div>

        <SummaryCard title="Later" value={fmt(plan.totals.later)} />
        <SummaryCard title="Unscheduled" value={fmt(plan.totals.unscheduled)} />
      </div>

      <Section title="What I need each week (clear view)" subtitle="4-week forecast + a simple weekly goal suggestion." />

      <div style={styles.weekStrip}>
        {plan.weeks.map((w) => (
          <div key={w.label} style={styles.weekCard}>
            <div style={{ fontSize: 13, opacity: 0.78, fontWeight: 900 }}>{w.label}</div>
            <div style={{ fontSize: 22, fontWeight: 950, marginTop: 8 }}>{fmt(w.total)}</div>
            <div style={{ marginTop: 8, opacity: 0.78, fontSize: 13 }}>
              Daily pace: <b>{fmt(clampMoney(w.total / 7))}</b>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={styles.panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Suggested weekly income target</div>
            <div style={{ fontWeight: 950, fontSize: 20 }}>{fmt(plan.avg4)}</div>
          </div>
          <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13 }}>Average of Weeks 1–4 (based on what’s still remaining).</div>
        </div>
      </div>

      <Section title="Daily Need (Next 7 days)" subtitle="A calm daily pace based on due dates in the next week." />
      <div style={styles.panel}>
        {plan.dailyNeed.length === 0 ? (
          <div style={{ opacity: 0.78 }}>Nothing with a due date in the next 7 days (or due dates not set yet).</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {plan.dailyNeed.map((x) => (
              <div key={x.b.key} style={styles.row}>
                <div>
                  <div style={{ fontWeight: 950 }}>{x.b.name}</div>
                  <div style={{ opacity: 0.78, fontSize: 13 }}>
                    Due: <b>{x.dueDate}</b> · Remaining: <b>{fmt(x.rem)}</b> {x.b.due ? `· ${x.b.due}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950 }}>{fmt(x.perDay)}/day</div>
                  <div style={{ opacity: 0.78, fontSize: 13 }}>{x.daysLeft} days left</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Section title="Now → Mar 7 Buckets" subtitle="Only what matters before March 7." />
      <div style={styles.bucketGrid}>
        {focusBuckets
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((b) => (
            <BucketCard key={b.key} bucket={b} />
          ))}
      </div>

      <Section title="Later Buckets" subtitle="These matter after the urgent stuff is covered." />
      <div style={styles.bucketGrid}>
        {otherBuckets
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((b) => (
            <BucketCard key={b.key} bucket={b} />
          ))}
      </div>

      <Section title="Log Income" subtitle="Add your daily pay, DoorDash, or any deposit." />
      <div style={styles.formRow}>
        <label style={styles.label}>
          Date
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Source
          <select value={entrySource} onChange={(e) => setEntrySource(e.target.value as any)} style={styles.input}>
            <option>Salon</option>
            <option>DoorDash</option>
            <option>Other</option>
          </select>
        </label>

        <label style={styles.label}>
          Amount
          <input
            inputMode="decimal"
            value={entryAmount ? String(entryAmount) : ""}
            onChange={(e) => setEntryAmount(Number(e.target.value))}
            placeholder="0"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Note (optional)
          <input value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder="e.g., lunch shift" style={styles.input} />
        </label>

        <button onClick={addIncome} style={btn()} disabled={clampMoney(entryAmount) <= 0}>
          Add
        </button>
      </div>

      <Section title="Allocate Unassigned" subtitle="Put money into a bucket once you’ve logged income." />
      <div style={styles.allocRow}>
        <label style={styles.label}>
          Bucket
          <select value={allocKey} onChange={(e) => setAllocKey(e.target.value as BucketKey)} style={styles.input}>
            {buckets.map((b) => {
              const left = b.target > 0 ? Math.max(0, b.target - b.saved) : 0;
              return (
                <option key={b.key} value={b.key}>
                  {b.name}
                  {b.target > 0 ? ` — ${fmt(left)} left` : ""}
                </option>
              );
            })}
          </select>
        </label>

        <label style={styles.label}>
          Amount (≤ unassigned)
          <input
            inputMode="decimal"
            value={allocAmt ? String(allocAmt) : ""}
            onChange={(e) => setAllocAmt(Number(e.target.value))}
            placeholder="0"
            style={styles.input}
          />
        </label>

        <button onClick={allocateUnassigned} style={btn()} disabled={clampMoney(allocAmt) <= 0 || totals.unassigned < clampMoney(allocAmt)}>
          Allocate
        </button>
      </div>

      <Section
        title="Manage Buckets"
        subtitle="Add/edit/delete buckets. NEW: monthly credit/loan buckets + balance/APR fields."
      />

      <div style={styles.panel}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950 }}>Add a bucket</div>

          <div style={styles.manageRowBig}>
            <label style={styles.label}>
              Name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Capital One" style={styles.input} />
            </label>

            <label style={styles.label}>
              Target
              <input
                inputMode="decimal"
                value={newTarget ? String(newTarget) : ""}
                onChange={(e) => setNewTarget(Number(e.target.value))}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Balance (optional)
              <input
                inputMode="decimal"
                value={newBalance ? String(newBalance) : ""}
                onChange={(e) => setNewBalance(Number(e.target.value))}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              APR % (optional)
              <input
                inputMode="decimal"
                value={newApr ? String(newApr) : ""}
                onChange={(e) => setNewApr(Number(e.target.value))}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Due note
              <input value={newDue} onChange={(e) => setNewDue(e.target.value)} placeholder="ASAP / Min payment" style={styles.input} />
            </label>

            <label style={styles.label}>
              Due date
              <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} style={styles.input} />
            </label>

            <label style={styles.label}>
              Priority
              <select value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value) as any)} style={styles.input}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>

            <label style={{ ...styles.label, alignSelf: "end" }}>
              <span>Focus</span>
              <input type="checkbox" checked={newFocus} onChange={(e) => setNewFocus(e.target.checked)} />
            </label>

            {/* ✅ NEW monthly toggles */}
            <label style={{ ...styles.label, alignSelf: "end" }}>
              <span>Monthly?</span>
              <input
                type="checkbox"
                checked={newIsMonthly}
                onChange={(e) => setNewIsMonthly(e.target.checked)}
              />
            </label>

            <label style={styles.label}>
              Monthly Target
              <input
                inputMode="decimal"
                value={newMonthlyTarget ? String(newMonthlyTarget) : ""}
                onChange={(e) => setNewMonthlyTarget(Number(e.target.value))}
                placeholder={newIsMonthly ? "e.g., 35" : "—"}
                style={styles.input}
                disabled={!newIsMonthly}
              />
            </label>

            <label style={styles.label}>
              Due day (1–31)
              <input
                inputMode="numeric"
                value={String(newDueDay)}
                onChange={(e) => setNewDueDay(Number(e.target.value))}
                placeholder="18"
                style={styles.input}
                disabled={!newIsMonthly}
              />
            </label>

            <button onClick={addBucket} style={btn()} disabled={!newName.trim()}>
              Add Bucket
            </button>
          </div>

          <div style={{ marginTop: 10, fontWeight: 950 }}>Edit existing buckets</div>

          <div style={{ display: "grid", gap: 10 }}>
            {buckets.map((b) => (
              <div key={b.key} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                <div style={styles.editGridBig}>
                  <label style={styles.label}>
                    Name
                    <input value={b.name} onChange={(e) => updateBucket(b.key, { name: e.target.value })} style={styles.input} />
                  </label>

                  <label style={styles.label}>
                    Target
                    <input
                      inputMode="decimal"
                      value={b.target ? String(b.target) : ""}
                      onChange={(e) => updateBucket(b.key, { target: Number(e.target.value) })}
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    Balance
                    <input
                      inputMode="decimal"
                      value={b.balance != null && b.balance !== 0 ? String(b.balance) : ""}
                      onChange={(e) => updateBucket(b.key, { balance: Number(e.target.value) })}
                      placeholder="0"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    APR %
                    <input
                      inputMode="decimal"
                      value={b.apr != null && b.apr !== 0 ? String(b.apr) : ""}
                      onChange={(e) => updateBucket(b.key, { apr: Number(e.target.value) })}
                      placeholder="0"
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.label}>
                    Due note
                    <input value={b.due ?? ""} onChange={(e) => updateBucket(b.key, { due: e.target.value })} style={styles.input} />
                  </label>

                  <label style={styles.label}>
                    Due date
                    <input type="date" value={b.dueDate ?? ""} onChange={(e) => updateBucket(b.key, { dueDate: e.target.value })} style={styles.input} />
                  </label>

                  <label style={styles.label}>
                    Priority
                    <select value={b.priority} onChange={(e) => updateBucket(b.key, { priority: Number(e.target.value) as any })} style={styles.input}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>

                  <label style={{ ...styles.label, alignSelf: "end" }}>
                    <span>Focus</span>
                    <input type="checkbox" checked={!!b.focus} onChange={(e) => updateBucket(b.key, { focus: e.target.checked })} />
                  </label>

                  {/* ✅ NEW monthly edit */}
                  <label style={{ ...styles.label, alignSelf: "end" }}>
                    <span>Monthly?</span>
                    <input
                      type="checkbox"
                      checked={!!b.isMonthly}
                      onChange={(e) => updateBucket(b.key, { isMonthly: e.target.checked })}
                    />
                  </label>

                  <label style={styles.label}>
                    Monthly Target
                    <input
                      inputMode="decimal"
                      value={b.monthlyTarget != null && b.monthlyTarget !== 0 ? String(b.monthlyTarget) : ""}
                      onChange={(e) => updateBucket(b.key, { monthlyTarget: Number(e.target.value) })}
                      placeholder="0"
                      style={styles.input}
                      disabled={!b.isMonthly}
                    />
                  </label>

                  <label style={styles.label}>
                    Due day
                    <input
                      inputMode="numeric"
                      value={String(b.dueDay ?? 1)}
                      onChange={(e) => updateBucket(b.key, { dueDay: Number(e.target.value) })}
                      placeholder="18"
                      style={styles.input}
                      disabled={!b.isMonthly}
                    />
                  </label>

                  <button
                    onClick={() => {
                      // snap monthly settings immediately (optional helper)
                      setBuckets((prev) => applyMonthlyAutoAdd(now, prev));
                    }}
                    style={btn()}
                    disabled={!b.isMonthly}
                    title="Re-apply monthly rules now"
                  >
                    Apply Monthly
                  </button>

                  <button onClick={() => removeBucket(b.key)} style={btn("danger")}>
                    Delete
                  </button>
                </div>

                <div style={{ marginTop: 6, opacity: 0.78, fontSize: 13 }}>
                  Key: <code>{b.key}</code> · Saved: <b>{fmt(b.saved)}</b> · Remaining: <b>{fmt(remaining(b))}</b>
                  {b.balance != null ? (
                    <>
                      {" "}
                      · Balance: <b>{fmt(b.balance)}</b>
                    </>
                  ) : null}
                  {b.apr != null && b.apr > 0 ? (
                    <>
                      {" "}
                      · APR: <b>{b.apr}%</b>
                    </>
                  ) : null}
                  {b.isMonthly ? (
                    <>
                      {" "}
                      · Monthly: <b>{fmt(clampMoney(b.monthlyTarget ?? b.target))}</b> · Due day: <b>{b.dueDay ?? "—"}</b>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Section title="Entries (by day)" subtitle="Your log, grouped by date." />
      <div style={{ display: "grid", gap: 12 }}>
        {grouped.dates.length === 0 ? (
          <div style={{ opacity: 0.78 }}>No entries yet. Add income above, then allocate to buckets.</div>
        ) : (
          grouped.dates.map((d) => (
            <div key={d} style={styles.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950 }}>{d}</div>
                <div style={{ opacity: 0.78 }}>
                  Day total: {fmt(grouped.byDate.get(d)!.reduce((s, e) => s + e.amount, 0))}
                </div>
              </div>

              {grouped.byDate.get(d)!.map((e) => {
                const allocatedInEntry = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
                const room = clampMoney(e.amount - allocatedInEntry);

                return (
                  <div key={e.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10, marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <b>{e.source}</b> · {fmt(e.amount)}{" "}
                        {e.note ? <span style={{ opacity: 0.78 }}>— {e.note}</span> : null}
                      </div>
                      <div style={{ opacity: 0.78 }}>Unallocated: {fmt(room)}</div>
                    </div>

                    {Object.keys(e.allocations || {}).length > 0 && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {Object.entries(e.allocations).map(([k, v]) => {
                          const b = bucketsByKey.get(k as BucketKey);
                          return (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ opacity: 0.9 }}>{b?.name ?? k}</div>
                              <div style={{ fontWeight: 900 }}>{fmt(v || 0)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <footer style={{ marginTop: 24, opacity: 0.78, fontSize: 13 }}>
        Tip: Add due dates for bills to power Weekly Plan + Daily Need. Use <b>/data</b> to export/import your board.
      </footer>
    </div>
  );
}

/* =============================
   STYLES
============================= */

const BACKGROUND_COLOR = "#eef4ff"; // change this: #f7f2ff (lavender) or #edf8f3 (mint)

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: BACKGROUND_COLOR,
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  weekStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  weekCard: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 1fr 2fr auto",
    gap: 8,
    alignItems: "end",
  },
  allocRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 8,
    alignItems: "end",
  },

  // ✅ widened grids to fit new fields
  manageRowBig: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 1.2fr 1fr auto auto 1fr 1fr auto",
    gap: 8,
    alignItems: "end",
  },
  editGridBig: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 1.2fr 1fr auto auto 1fr 1fr auto auto",
    gap: 8,
    alignItems: "end",
  },

  label: { display: "grid", gap: 6, fontSize: 13, opacity: 0.96 },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    background: "white",
  },
};
