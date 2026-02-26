"use client";

import React from "react";
import { useMoneyStore } from "@/lib/money/store";
import { MoneyShell, Section, AddBucketForm } from "@/lib/money/ui";

export default function AddEditPage() {
  const store = useMoneyStore();

  return (
    <MoneyShell title="Add / Edit" subtitle="Create new bills, cards, and loans.">
      <Section title="Add a bucket" subtitle="Bills, credit cards, and loans — including monthly due day." />

      <AddBucketForm
        newName={store.newName}
        setNewName={store.setNewName}
        newTarget={store.newTarget}
        setNewTarget={store.setNewTarget}
        newDue={store.newDue}
        setNewDue={store.setNewDue}
        newDueDate={store.newDueDate}
        setNewDueDate={store.setNewDueDate}
        newPriority={store.newPriority}
        setNewPriority={store.setNewPriority}
        newFocus={store.newFocus}
        setNewFocus={store.setNewFocus}
        newKind={store.newKind}
        setNewKind={store.setNewKind}
        newBalance={store.newBalance}
        setNewBalance={store.setNewBalance}
        newApr={store.newApr}
        setNewApr={store.setNewApr}
        newMinPayment={store.newMinPayment}
        setNewMinPayment={store.setNewMinPayment}
        newCreditLimit={store.newCreditLimit}
        setNewCreditLimit={store.setNewCreditLimit}
        newIsMonthly={store.newIsMonthly}
        setNewIsMonthly={store.setNewIsMonthly}
        newMonthlyTarget={store.newMonthlyTarget}
        setNewMonthlyTarget={store.setNewMonthlyTarget}
        newDueDay={store.newDueDay}
        setNewDueDay={store.setNewDueDay}
        onAdd={store.addBucket}
      />
    </MoneyShell>
  );
}
