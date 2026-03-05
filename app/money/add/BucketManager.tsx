"use client";

import React, { useMemo, useState } from "react";
import type { Bucket, BucketKey } from "@/lib/money/types";
import { useMoneyStore } from "@/lib/money/store";
import { btn } from "@/lib/money/ui";

function money(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default function BucketManager() {
  const store = useMoneyStore();

  // local edit buffer per bucket key (so typing doesn’t feel “laggy”)
  const [drafts, setDrafts] = useState<Record<string, Partial<Bucket>>>({});

  const buckets = useMemo(() => {
    return store.buckets
      .slice()
      .sort(
        (a, b) =>
          (a.priority ?? 2) - (b.priority ?? 2) ||
          (b.focus ? 0 : 1) - (a.focus ? 0 : 1) ||
          a.name.localeCompare(b.name)
      );
  }, [store.buckets]);

  function d(key: BucketKey) {
    return drafts[key] || {};
  }

  function setDraft(key: BucketKey, patch: Partial<Bucket>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  }

  function save(key: BucketKey) {
    const patch = drafts[key];
    if (!patch) return;

    // clean up numeric fields
    const cleaned: Partial<Bucket> = {
      ...patch,
      target: patch.target == null ? undefined : money(patch.target),
      balance: patch.balance == null ? undefined : money(patch.balance),
      apr: patch.apr == null ? undefined : money(patch.apr),
      minPayment: patch.minPayment == null ? undefined : money(patch.minPayment),
      creditLimit: patch.creditLimit == null ? undefined : money(patch.creditLimit),
      monthlyTarget: patch.monthlyTarget == null ? undefined : money(patch.monthlyTarget),
      dueDay: patch.dueDay == null ? undefined : Number(patch.dueDay),
      due: patch.due == null ? undefined : (patch.due || "").trim(),
      dueDate: patch.dueDate == null ? undefined : (patch.dueDate || "").trim(),
      name: patch.name == null ? undefined : (patch.name || "").trim(),
    };

    store.updateBucket(key, cleaned);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function revert(key: BucketKey) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function del(key: BucketKey, name: string) {
    const ok = window
