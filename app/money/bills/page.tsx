"use client";

import React from "react";
import { useMoneyStore } from "@/lib/money/store";
import { MoneyShell, Section, BucketGrid, BucketCard } from "@/lib/money/ui";

export default function BillsDebtPage() {
  const { buckets } = useMoneyStore();

  const focus = buckets.filter((b) => b.focus);
  const other = buckets.filter((b) => !b.focus);

  return (
    <MoneyShell title="Bills / Debt" subtitle="Buckets + balances. (Allocate from Income page.)">
      <Section title="Focus Buckets" />
      <BucketGrid>
        {focus.map((b) => (
          <BucketCard key={b.key} bucket={b} />
        ))}
      </BucketGrid>

      <Section title="Other Buckets" />
      <BucketGrid>
        {other.map((b) => (
          <BucketCard key={b.key} bucket={b} />
        ))}
      </BucketGrid>
    </MoneyShell>
  );
}
