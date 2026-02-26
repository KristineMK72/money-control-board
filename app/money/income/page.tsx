"use client";

import React from "react";
import { useMoneyStore } from "@/lib/money/store";
import { MoneyShell, Section, SummaryRow, IncomeForm, AllocateForm } from "@/lib/money/ui";

export default function IncomePage() {
  const { totals } = useMoneyStore();

  return (
    <MoneyShell title="Income" subtitle="Log income + allocate unassigned.">
      <SummaryRow
        items={[
          { title: "Income Logged", value: totals.income },
          { title: "Allocated", value: totals.allocated },
          { title: "Unassigned", value: totals.unassigned, hint: "What you can allocate next." },
        ]}
      />

      <Section title="Log Income" />
      <IncomeForm />

      <Section title="Allocate Unassigned" />
      <AllocateForm />
    </MoneyShell>
  );
}
