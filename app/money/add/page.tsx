"use client";

import React, { useState } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { Bucket } from "@/lib/money/types";
import { MoneyShell, Section, AddBucketForm } from "@/lib/money/ui";

export default function AddEditPage() {
  const store = useMoneyStore();

  // ---- Local form state (NOT store state)
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState(0);
  const [newDue, setNewDue] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(1);
  const [newFocus, setNewFocus] = useState(false);

  const [newKind, setNewKind] = useState<Bucket["kind"]>("bill");
  const [newBalance, setNewBalance] = useState(0);
  const [newApr, setNewApr] = useState(0);
  const [newMinPayment, setNewMinPayment] = useState(0);
  const [newCreditLimit, setNewCreditLimit] = useState(0);

  const [newIsMonthly, setNewIsMonthly] = useState(false);
  const [newMonthlyTarget, setNewMonthlyTarget] = useState(0);
  const [newDueDay, setNewDueDay] = useState(1);

  const onAdd = () => {
    if (!newName.trim()) return;

    store.addBucket({
      name: newName.trim(),
      target: Number(newTarget || 0),
      due: newDue || undefined,
      dueDate: newDueDate || undefined,
      priority: newPriority,
      focus: newFocus,
      kind: newKind,
      balance: newBalance || undefined,
      apr: newApr || undefined,
      minPayment: newMinPayment || undefined,
      creditLimit: newCreditLimit || undefined,
      isMonthly: newIsMonthly,
      monthlyTarget: newIsMonthly ? newMonthlyTarget : undefined,
      dueDay: newIsMonthly ? newDueDay : undefined,
    });

    // reset form
    setNewName("");
    setNewTarget(0);
    setNewDue("");
    setNewDueDate("");
    setNewPriority(1);
    setNewFocus(false);
    setNewKind("bill");
    setNewBalance(0);
    setNewApr(0);
    setNewMinPayment(0);
    setNewCreditLimit(0);
    setNewIsMonthly(false);
    setNewMonthlyTarget(0);
    setNewDueDay(1);
  };

  return (
    <MoneyShell title="Add / Edit" subtitle="Create new bills, cards, and loans.">
      <Section title="Add a bucket" subtitle="Bills, credit cards, loans, monthly due buckets." />

      <AddBucketForm
        newName={newName}
        setNewName={setNewName}
        newTarget={newTarget}
        setNewTarget={setNewTarget}
        newDue={newDue}
        setNewDue={setNewDue}
        newDueDate={newDueDate}
        setNewDueDate={setNewDueDate}
        newPriority={newPriority}
        setNewPriority={setNewPriority}
        newFocus={newFocus}
        setNewFocus={setNewFocus}
        newKind={newKind}
        setNewKind={setNewKind}
        newBalance={newBalance}
        setNewBalance={setNewBalance}
        newApr={newApr}
        setNewApr={setNewApr}
        newMinPayment={newMinPayment}
        setNewMinPayment={setNewMinPayment}
        newCreditLimit={newCreditLimit}
        setNewCreditLimit={setNewCreditLimit}
        newIsMonthly={newIsMonthly}
        setNewIsMonthly={setNewIsMonthly}
        newMonthlyTarget={newMonthlyTarget}
        setNewMonthlyTarget={setNewMonthlyTarget}
        newDueDay={newDueDay}
        setNewDueDay={setNewDueDay}
        onAdd={onAdd}
      />
    </MoneyShell>
  );
}
