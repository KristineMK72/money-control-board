"use client";

import React from "react";
import { MoneyShell, Section, AddBucketForm } from "@/lib/money/ui";

export default function AddEditPage() {
  return (
    <MoneyShell title="Add / Edit" subtitle="Create new bills, cards, and loans.">
      <Section title="Add a bucket" />
      <AddBucketForm />
    </MoneyShell>
  );
}
