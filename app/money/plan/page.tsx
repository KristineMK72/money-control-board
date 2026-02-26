"use client";

import React, { useMemo } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { Bucket } from "@/lib/money/types";
import { clampMoney } from "@/lib/money/utils";
import { MoneyShell, Section, WeekStrip, DailyNeedList } from "@/lib/money/ui";

function iso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseISODate(s?: string | null) {
  if (!s) return null;
  // Expecting "YYYY-MM-DD"
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function remaining(bucket: Bucket) {
  const target = bucket.target ?? 0;
  const saved = bucket.saved ?? 0;
  if (target <= 0) return 0;
  return clampMoney(Math.max(0, target - saved));
}

export default function PlanPage() {
  const store = useMoneyStore();

  // Prefer store.plan if it exists + has the fields we need,
  // otherwise compute from buckets.
  const computed = useMemo(() => {
    const buckets = store.buckets ?? [];

    const now = startOfDay(new Date());
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);

    // --- daily need list (next 7 days)
    const dailyNeed = buckets
      .map((b) => {
        const due = parseISODate(b.dueDate);
        if (!due) return null;

        const dueDay = startOfDay(due);
        if (dueDay < now || dueDay > next7) return null;

        const rem = remaining(b);
        if (rem <= 0) return null;

        const msPerDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.max(0, Math.ceil((dueDay.getTime() - now.getTime()) / msPerDay));
        const denom = Math.max(1, daysLeft); // avoid divide by 0 (due today)
        const perDay = clampMoney(rem / denom);

        return {
          name: b.name,
          dueDate: iso(dueDay),
          rem,
          perDay,
          daysLeft,
        };
      })
      .filter(Boolean) as Array<{ name: string; dueDate: string; rem: number; perDay: number; daysLeft: number }>;

    dailyNeed.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // --- 4-week strip (simple buckets-with-due-dates grouping)
    const weekStart = startOfDay(new Date(now));
    const weeks: Array<{ label: string; total: number }> = [];

    for (let i = 0; i < 4; i++) {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() + i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);

      const total = buckets.reduce((sum, b) => {
        const due = parseISODate(b.dueDate);
        if (!due) return sum;
        const dueDay = startOfDay(due);
        if (dueDay >= ws && dueDay < we) return sum + remaining(b);
        return sum;
      }, 0);

      const label = `${iso(ws)} → ${iso(new Date(we.getFullYear(), we.getMonth(), we.getDate() - 1))}`;
      weeks.push({ label, total: clampMoney(total) });
    }

    return { weeks, dailyNeed };
  }, [store.buckets]);

  const plan = (store as any).plan;
  const weeks =
    plan?.weeks && Array.isArray(plan.weeks) ? plan.weeks : computed.weeks;

  const dailyNeed =
    plan?.dailyNeed && Array.isArray(plan.dailyNeed) ? plan.dailyNeed : computed.dailyNeed;

  return (
    <MoneyShell title="Plan" subtitle="Weekly income needed + daily pace.">
      <Section title="Income Needed Each Week" subtitle="Based on remaining amounts with due dates." />
      <WeekStrip weeks={weeks} />

      <Section title="Next 7 days pace" subtitle="Daily pace for what’s due soon." />
      <DailyNeedList items={dailyNeed} />
    </MoneyShell>
  );
}
