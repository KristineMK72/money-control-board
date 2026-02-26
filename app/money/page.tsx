"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useMoneyStore } from "@/lib/money/store";
import { fmt } from "@/lib/money/utils";
import { linkBtn, Section, SummaryCard, styles, btn } from "@/lib/money/ui";

export default function MoneyMainPage() {
  const store = useMoneyStore();

  const debtTotals = useMemo(() => {
    const creditBal = store.buckets
      .filter((b) => b.kind === "credit" && b.balance != null)
      .reduce((s, b) => s + (b.balance || 0), 0);

    const loanBal = store.buckets
      .filter((b) => b.kind === "loan" && b.balance != null)
      .reduce((s, b) => s + (b.balance || 0), 0);

    return { creditBal, loanBal };
  }, [store.buckets]);

  const focusNeed = useMemo(() => {
    return store.buckets
      .filter((b) => b.focus && (b.target ?? 0) > 0)
      .reduce((s, b) => s + Math.max(0, (b.target ?? 0) - (b.saved ?? 0)), 0);
  }, [store.buckets]);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 950 }}>Money Control Board</h1>
          <div style={{ opacity: 0.78, marginTop: 6 }}>Master dashboard (everything ties together)</div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/money/bills" style={linkBtn()}>
              Bills/Debt
            </Link>
            <Link href="/money/income" style={linkBtn()}>
              Income
            </Link>
            <Link href="/money/plan" style={linkBtn()}>
              Plan
            </Link>
            <Link href="/money/add" style={linkBtn()}>
              Add/Edit
            </Link>
          </div>
        </div>

        <button onClick={store.resetAll} style={btn("danger")}>
          Reset
        </button>
      </header>

      <div style={styles.grid3}>
        <SummaryCard title="Income Logged" value={fmt(store.totals.income)} />
        <SummaryCard title="Allocated" value={fmt(store.totals.allocated)} />
        <SummaryCard
          title="Unassigned"
          value={fmt(store.totals.unassigned)}
          hint="What you can allocate next."
        />
      </div>

      <Section title="At-a-glance" />
      <div style={styles.grid3}>
        <SummaryCard
          title="Focus Buckets Remaining"
          value={fmt(focusNeed)}
          hint="How much your ‘now’ list still needs."
        />
        <SummaryCard title="Credit Balances" value={fmt(debtTotals.creditBal)} hint="Sum of credit cards with balances." />
        <SummaryCard title="Loan Balances" value={fmt(debtTotals.loanBal)} hint="Sum of loans with balances." />
      </div>

      <Section title="Quick links" subtitle="Use the sub-pages for the detailed dashboards." />
      <div style={styles.grid2}>
        <div style={styles.panel}>
          <div style={{ fontWeight: 950 }}>Bills/Debt</div>
          <div style={{ opacity: 0.78, marginTop: 6 }}>See buckets + balances.</div>
          <div style={{ marginTop: 10 }}>
            <Link href="/money/bills" style={linkBtn()}>
              Open Bills/Debt
            </Link>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={{ fontWeight: 950 }}>Plan</div>
          <div style={{ opacity: 0.78, marginTop: 6 }}>Weekly income needed + daily pace.</div>
          <div style={{ marginTop: 10 }}>
            <Link href="/money/plan" style={linkBtn()}>
              Open Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
