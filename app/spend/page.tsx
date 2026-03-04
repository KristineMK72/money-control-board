"use client";

import { useEffect, useMemo, useState } from "react";
import { ocrImageFile, parseReceiptText } from "@/lib/money/receiptOcr";
import type { SpendCategory, SpendEntry, StorageShape } from "@/lib/money/types";
import { useMoneyStore } from "@/lib/money/store";
import { STORAGE_KEY } from "@/lib/money/storageKey";
import { clampMoney, monthKeyFromISO, todayISO } from "@/lib/money/utils";

/** ---------- categories ---------- */
const CATEGORY_LABEL: Record<SpendCategory, string> = {
  groceries: "Groceries",
  gas: "Gas",
  eating_out: "Eating Out",
  kids: "Kids",
  business: "Business",
  self_care: "Self Care",
  subscriptions: "Subscriptions",
  misc: "Misc",
};

const CATEGORIES = Object.keys(CATEGORY_LABEL) as SpendCategory[];

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function formatUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function monthKeyNow() {
  return monthKeyFromISO(todayISO()); // "YYYY-MM"
}

function prevMonthKey(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function groupByCategory(entries: SpendEntry[]) {
  const out: Record<SpendCategory, number> = {
    groceries: 0,
    gas: 0,
    eating_out: 0,
    kids: 0,
    business: 0,
    self_care: 0,
    subscriptions: 0,
    misc: 0,
  };
  for (const e of entries) out[e.category] += e.amount;
  return out;
}

/** ---------- charts (SVG, no libs) ---------- */
function DonutChart({
  values,
  size = 140,
  stroke = 18,
}: {
  values: { label: string; value: number }[];
  size?: number;
  stroke?: number;
}) {
  const total = sum(values.map((v) => v.value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const palette = ["#7c3aed", "#06b6d4", "#f59e0b", "#ef4444", "#22c55e", "#e11d48", "#3b82f6", "#a3a3a3"];

  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={stroke}
      />
      {values.map((v, i) => {
        const frac = total === 0 ? 0 : v.value / total;
        const dash = frac * c;
        const gap = c - dash;
        const offset = -acc * c;
        acc += frac;

        return (
          <circle
            key={v.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={palette[i % palette.length]}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fill="currentColor"
        style={{ fontWeight: 800 }}
      >
        {formatUSD(total)}
      </text>
      <text
        x="50%"
        y="62%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="11"
        fill="rgba(0,0,0,0.55)"
      >
        this month
      </text>
    </svg>
  );
}

function BarChart({
  values,
  height = 140,
}: {
  values: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="grid grid-cols-4 gap-3 items-end" style={{ height }}>
      {values.map((v) => {
        const h = Math.round((v.value / max) * 100);
        return (
          <div key={v.label} className="flex flex-col gap-2 items-center">
            <div className="w-full rounded-xl bg-black/5 overflow-hidden" style={{ height: height - 42 }}>
              <div className="w-full rounded-xl bg-black/30" style={{ height: `${h}%` }} />
            </div>
            <div className="text-[11px] text-black/70 text-center leading-tight">
              <div className="font-semibold">{v.label}</div>
              <div>{formatUSD(v.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SpendPage() {
  // Use the real store (so save/load stays consistent)
  const { spend, addSpend, removeSpend } = useMoneyStore();

  const [month, setMonth] = useState<string>(monthKeyNow());
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<SpendCategory>("groceries");
  const [note, setNote] = useState<string>("");

  // ✅ Optional: make sure old storage gets upgraded to include spend (non-breaking)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StorageShape;

      if (!Array.isArray(parsed.spend)) {
        const upgraded: StorageShape = { ...parsed, spend: [] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
      }
    } catch {}
  }, []);

  const entriesThisMonth = useMemo(
    () => spend.filter((s) => monthKeyFromISO(s.dateISO) === month),
    [spend, month]
  );

  const entriesPrevMonth = useMemo(() => {
    const pm = prevMonthKey(month);
    return spend.filter((s) => monthKeyFromISO(s.dateISO) === pm);
  }, [spend, month]);

  const totalsThis = useMemo(() => groupByCategory(entriesThisMonth), [entriesThisMonth]);
  const totalsPrev = useMemo(() => groupByCategory(entriesPrevMonth), [entriesPrevMonth]);

  const totalThis = useMemo(() => sum(Object.values(totalsThis)), [totalsThis]);
  const totalPrev = useMemo(() => sum(Object.values(totalsPrev)), [totalsPrev]);

  const topThis = useMemo(() => {
    const sorted = CATEGORIES.map((c) => ({ c, v: totalsThis[c] })).sort((a, b) => b.v - a.v);
    return sorted[0];
  }, [totalsThis]);

  const insight = useMemo(() => {
    if (!topThis || totalThis <= 0) return "Log a few purchases and you’ll start seeing patterns here.";
    const pct = Math.round((topThis.v / totalThis) * 100);
    const prev = totalsPrev[topThis.c] || 0;
    const delta = prev === 0 ? null : Math.round(((topThis.v - prev) / prev) * 100);

    if (delta === null) return `${CATEGORY_LABEL[topThis.c]} is your top category (${pct}%).`;
    if (delta > 15) return `${CATEGORY_LABEL[topThis.c]} is up ${delta}% vs last month.`;
    if (delta < -15) return `${CATEGORY_LABEL[topThis.c]} is down ${Math.abs(delta)}% vs last month.`;
    return `${CATEGORY_LABEL[topThis.c]} is your top category (${pct}%).`;
  }, [topThis, totalThis, totalsPrev]);

  const donutData = useMemo(
    () =>
      CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], value: totalsThis[c] })).filter((x) => x.value > 0),
    [totalsThis]
  );

  const top4Bars = useMemo(() => {
    const sorted = CATEGORIES
      .map((c) => ({ label: CATEGORY_LABEL[c].split(" ")[0], value: totalsThis[c] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);

    return sorted.length
      ? sorted
      : [
          { label: "—", value: 0 },
          { label: "—", value: 0 },
          { label: "—", value: 0 },
          { label: "—", value: 0 },
        ];
  }, [totalsThis]);

  function onAdd() {
    const n = clampMoney(Number(amount));
    if (!n || n <= 0) return;

    addSpend({
      dateISO: todayISO(),
      amount: n,
      category,
      note: note.trim(),
    });

    setAmount("");
    setNote("");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Spend Tracker</h1>
            <p className="text-sm text-black/60">Track real spending, spot leaks, and protect your buckets.</p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-black/60">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-black/50">This month</div>
                <div className="mt-1 text-3xl font-extrabold">{formatUSD(totalThis)}</div>
                <div className="mt-1 text-sm text-black/60">Last month: {formatUSD(totalPrev)}</div>
              </div>
              <DonutChart values={donutData.length ? donutData : [{ label: "None", value: 0 }]} />
            </div>

            <div className="mt-4 rounded-xl bg-black/5 p-3 text-sm">
              <div className="text-xs font-semibold text-black/50">Insight</div>
              <div className="mt-1 font-semibold">{insight}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-black/50">Top categories</div>
            <div className="mt-4">
              <BarChart values={top4Bars} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-black/50">Quick add</div>

            <div className="mt-3 grid gap-2">
              <div className="grid grid-cols-3 gap-2">
                <input
                  inputMode="decimal"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="col-span-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SpendCategory)}
                  className="col-span-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>

              <input
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
              />

              <button
                onClick={onAdd}
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Add spend
              </button>

              <div className="text-xs text-black/50">Tip: log purchases as they happen. This becomes your reality check.</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold text-black/50">Entries</div>
          <div className="mt-1 text-sm text-black/60">
            Showing {entriesThisMonth.length} item(s) for {month}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/50">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-0 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entriesThisMonth.map((e) => (
                  <tr key={e.id} className="border-t border-black/5">
                    <td className="py-2 pr-3 whitespace-nowrap">{e.dateISO}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{CATEGORY_LABEL[e.category]}</td>
                    <td className="py-2 pr-3 max-w-[420px] truncate text-black/70">{e.note || "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatUSD(e.amount)}</td>
                    <td className="py-2 pr-0 text-right">
                      <button
                        onClick={() => removeSpend(e.id)}
                        className="rounded-lg border border-black/10 px-3 py-1 text-xs font-semibold hover:bg-black/5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {entriesThisMonth.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-black/50">
                      No spend logged for this month yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
