"use client";

import React, { useMemo, useState } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { BucketKey, Entry } from "@/lib/money/types";
import { fmt } from "@/lib/money/utils";
import { MoneyShell, Section, SummaryRow, SummaryCard, IncomeForm, AllocateForm } from "@/lib/money/ui";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type MoneyStoreLike = ReturnType<typeof useMoneyStore> & {
  // optional, depending on how your store.ts is wired
  addIncome?: (p: { dateISO: string; source: Entry["source"]; amount: number; note?: string }) => void;
  addIncomeEntry?: (p: { dateISO: string; source: Entry["source"]; amount: number; note?: string }) => void;
  allocateAmount?: (key: BucketKey, amt: number) => void;
  allocate?: (key: BucketKey, amt: number) => void;
};

export default function IncomePage() {
  const store = useMoneyStore() as MoneyStoreLike;
  const totals = store.totals;

  // Local UI state for the forms
  const [entryDate, setEntryDate] = useState<string>(todayISO());
  const [entrySource, setEntrySource] = useState<Entry["source"]>("Salon");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryNote, setEntryNote] = useState<string>("");

  const buckets = store.buckets;

  const firstBucketKey = useMemo<BucketKey>(() => {
    return (buckets[0]?.key ?? "misc") as BucketKey;
  }, [buckets]);

  const [allocKey, setAllocKey] = useState<BucketKey>(firstBucketKey);
  const [allocAmt, setAllocAmt] = useState<number>(0);

  // Keep allocKey valid if buckets load/change
  React.useEffect(() => {
    if (!buckets.find((b) => b.key === allocKey)) {
      setAllocKey(firstBucketKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets.length, firstBucketKey]);

  const onAddIncome = () => {
    const amt = Number(entryAmount || 0);
    if (!amt || amt <= 0) return;

    const payload = {
      dateISO: entryDate, // ✅ match your Entry type
      source: entrySource,
      amount: amt,
      note: entryNote.trim() || undefined,
    };

    if (typeof store.addIncomeEntry === "function") store.addIncomeEntry(payload);
    else if (typeof store.addIncome === "function") store.addIncome(payload);
    else {
      console.warn("No addIncome/addIncomeEntry found on store. Wire this in lib/money/store.ts.");
      return;
    }

    setEntryAmount(0);
    setEntryNote("");
  };

  const onAllocate = () => {
    const amt = Number(allocAmt || 0);
    if (!amt || amt <= 0) return;

    if (typeof store.allocateAmount === "function") store.allocateAmount(allocKey, amt);
    else if (typeof store.allocate === "function") store.allocate(allocKey, amt);
    else {
      console.warn("No allocateAmount/allocate found on store. Wire this in lib/money/store.ts.");
      return;
    }

    setAllocAmt(0);
  };

  return (
    <MoneyShell title="Income" subtitle="Log income + allocate unassigned.">
      <SummaryRow>
        <SummaryCard title="Income Logged" value={fmt(totals.income)} />
        <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
        <SummaryCard title="Unassigned" value={fmt(totals.unassigned)} hint="What you can allocate next." />
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

      <Section title="Allocate Unassigned" subtitle={`Available: ${fmt(totals.unassigned)}`} />
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
