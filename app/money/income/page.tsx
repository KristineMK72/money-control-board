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

export default function IncomePage() {
  const store = useMoneyStore();
  const totals = store.totals;

  // --- Local UI state for the forms
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

  // If buckets load/change, keep allocKey valid
  React.useEffect(() => {
    if (!buckets.find((b) => b.key === allocKey)) {
      setAllocKey(firstBucketKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets.length, firstBucketKey]);

  // --- Handlers that try common store method names safely
  const onAddIncome = () => {
    const amt = Number(entryAmount || 0);
    if (!amt || amt <= 0) return;

    const payload = {
      date: entryDate,
      source: entrySource,
      amount: amt,
      note: entryNote || "",
    };

    const s: any = store as any;

    // Try common method names (one of these likely exists)
    if (typeof s.addIncome === "function") s.addIncome(payload);
    else if (typeof s.addIncomeEntry === "function") s.addIncomeEntry(payload);
    else if (typeof s.addEntry === "function") s.addEntry(payload);
    else if (typeof s.logIncome === "function") s.logIncome(payload);
    else {
      // If none exist, do nothing (prevents crashes). We can adjust once you show store.ts.
      console.warn("No income-add method found on store. Show lib/money/store.ts and I’ll wire it exactly.");
      return;
    }

    // reset quick fields
    setEntryAmount(0);
    setEntryNote("");
  };

  const onAllocate = () => {
    const amt = Number(allocAmt || 0);
    if (!amt || amt <= 0) return;

    const s: any = store as any;

    // Try common method names
    if (typeof s.allocate === "function") s.allocate(allocKey, amt);
    else if (typeof s.allocateToBucket === "function") s.allocateToBucket(allocKey, amt);
    else if (typeof s.allocateUnassigned === "function") s.allocateUnassigned(allocKey, amt);
    else if (typeof s.allocateAmount === "function") s.allocateAmount(allocKey, amt);
    else {
      console.warn("No allocate method found on store. Show lib/money/store.ts and I’ll wire it exactly.");
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
