"use client";

import React from "react";
import { useMoneyStore } from "@/lib/money/store";
import { MoneyShell, Section, WeekStrip, DailyNeedList } from "@/lib/money/ui";

export default function PlanPage() {
  const { plan } = useMoneyStore();

  return (
    <MoneyShell title="Plan" subtitle="Weekly income needed + daily pace.">
      <Section title="Income Needed Each Week" subtitle="Based on remaining amounts with due dates." />
      <WeekStrip weeks={plan.weeks} />

      <Section title="Next 7 days pace" subtitle="Daily pace for what’s due soon." />
      <DailyNeedList items={plan.dailyNeed} />
    </MoneyShell>
  );
}
