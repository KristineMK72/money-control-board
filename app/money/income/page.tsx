"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { BucketKey, Entry } from "@/lib/money/types";
import { fmt } from "@/lib/money/utils";
import {
  MoneyShell,
  Section,
  SummaryRow,
  SummaryCard,
  IncomeForm,
  AllocateForm,
} from "@/lib/money/ui";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function IncomePage() {
  // ✅ No casting. Use the real typed store.
  const store = useMoneyStore();

  const totals = store.totals;
  const buckets = store.buckets;

  // Local UI state for the forms
  const [entryDate, setEntryDate] = useState<string>(todayISO());
  const [entrySource, setEntrySource] = useState<Entry["source"]>("Salon");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryNote, setEntryNote] = useState<string>("");

  const firstBucketKey = useMemo<BucketKey>(() => {
    return (buckets[0]?.key ?? "misc") as BucketKey;
  }, [buckets]);

  const [allocKey, setAllocKey] = useState<BucketKey>(firstBucketKey);
  const [allocAmt, setAllocAmt] = useState<number>(0);

  // Keep allocKey valid if buckets load/change
  useEffect(() => {
    if (!buckets.find((b) => b.key === allocKey)) {
      setAllocKey(firstBucketKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets.length, firstBucketKey]);

  const onAddIncome = () => {
    const amt = Number(entryAmount || 0);
    if (!amt || amt <= 0) return;

    store.addIncome({
      dateISO: entryDate,
      source: entrySource,
      amount: amt,
      note: entryNote.trim() || undefined,
    });

    setEntryAmount(0);
    setEntryNote("");
  };

  const onAllocate = () => {
    const amt = Number(allocAmt || 0);
    if (!amt || amt <= 0) return;

    store.allocateAmount(allocKey, amt);
    setAllocAmt(0);
  };

  return (
    <MoneyShell title="Income" subtitle="Log income + allocate unassigned.">
      <SummaryRow>
        <SummaryCard title="Income Logged" value={fmt(totals.income)} />
        <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
        <SummaryCard
          title="Unassigned"
          value={fmt(totals.unassigned)}
          hint="What you can allocate next."
        />
      </SummaryRow>

      <Section title="Log Income" />
      <IncomeForm
        entryDate={entryDate}
        setEntryDate={setEntryDate}
        entrySource={entrySource}
        setEntrySource={setEntrySource}
        entryAmount={entryAmount}
        setEntryAmount={setEntryAmount}
        entryNote={entryNote}
        setEntryNote={setEntryNote}
        onAdd={onAddIncome}
      />

      <Section
        title="Allocate Unassigned"
        subtitle={`Available: ${fmt(totals.unassigned)}`}
      />
      <AllocateForm
        buckets={buckets}
        allocKey={allocKey}
        setAllocKey={setAllocKey}
        allocAmt={allocAmt}
        setAllocAmt={setAllocAmt}
        onAllocate={onAllocate}
      />
    </MoneyShell>
  );
}
