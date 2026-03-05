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

      focus: patch.focus == null ? undefined : !!patch.focus,
      isMonthly: patch.isMonthly == null ? undefined : !!patch.isMonthly,
      kind: patch.kind == null ? undefined : patch.kind,
      priority: patch.priority == null ? undefined : patch.priority,
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
    const ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!ok) return;

    const anyStore = store as any;
    if (typeof anyStore.deleteBucket === "function") anyStore.deleteBucket(key);
    else if (typeof anyStore.removeBucket === "function") anyStore.removeBucket(key);

    revert(key);
  }

  const card: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.8)",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 700,
    marginBottom: 6,
  };

  const input: React.CSSProperties = {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    width: "100%",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {buckets.map((b) => {
        const draft = d(b.key);
        const dirty = Object.keys(draft).length > 0;

        const name = (draft.name ?? b.name) as string;
        const target = (draft.target ?? b.target) as any;
        const due = (draft.due ?? (b.due || "")) as string;
        const dueDate = (draft.dueDate ?? ((b as any).dueDate || "")) as string;
        const priority = (draft.priority ?? b.priority ?? 2) as 1 | 2 | 3;
        const focus = !!(draft.focus ?? b.focus ?? false);
        const kind = (draft.kind ?? b.kind ?? "bill") as Bucket["kind"];

        const isMonthly = !!(draft.isMonthly ?? (b as any).isMonthly);
        const monthlyTarget = (draft.monthlyTarget ?? ((b as any).monthlyTarget ?? 0)) as any;
        const dueDay = (draft.dueDay ?? ((b as any).dueDay ?? 1)) as any;

        const showDebtFields = kind === "credit" || kind === "loan";
        const balance = (draft.balance ?? (b.balance ?? 0)) as any;
        const apr = (draft.apr ?? (b.apr ?? 0)) as any;
        const minPayment = (draft.minPayment ?? (b.minPayment ?? 0)) as any;
        const creditLimit = (draft.creditLimit ?? (b.creditLimit ?? 0)) as any;

        return (
          <div key={b.key} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900 }}>
                {b.name}{" "}
                <span style={{ opacity: 0.5, fontWeight: 700 }}>({b.key})</span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => save(b.key)} disabled={!dirty} style={btn(dirty ? "primary" : "default")}>
                  Save
                </button>
                <button onClick={() => revert(b.key)} disabled={!dirty} style={btn()}>
                  Revert
                </button>
                <button onClick={() => del(b.key, b.name)} style={btn("danger")}>
                  Delete
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <div>
                  <div style={label}>Name</div>
                  <input
                    style={input}
                    value={name}
                    onChange={(e) => setDraft(b.key, { name: e.target.value })}
                  />
                </div>

                <div>
                  <div style={label}>Target</div>
                  <input
                    style={input}
                    inputMode="decimal"
                    value={target}
                    onChange={(e) => setDraft(b.key, { target: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={label}>Due (label)</div>
                  <input
                    style={input}
                    value={due}
                    onChange={(e) => setDraft(b.key, { due: e.target.value })}
                    placeholder="ASAP / Feb 28 / rolling…"
                  />
                </div>

                <div>
                  <div style={label}>Due date</div>
                  <input
                    style={input}
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDraft(b.key, { dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <div style={label}>Priority</div>
                  <select
                    style={input}
                    value={priority}
                    onChange={(e) => setDraft(b.key, { priority: Number(e.target.value) as 1 | 2 | 3 })}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>

                <div>
                  <div style={label}>Kind</div>
                  <select
                    style={input}
                    value={kind}
                    onChange={(e) => setDraft(b.key, { kind: e.target.value as any })}
                  >
                    <option value="bill">Bill</option>
                    <option value="credit">Credit</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>

                <div style={{ display: "grid", alignItems: "end" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                    <input
                      type="checkbox"
                      checked={focus}
                      onChange={(e) => setDraft(b.key, { focus: e.target.checked })}
                    />
                    Focus
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 900 }}>
                  <input
                    type="checkbox"
                    checked={isMonthly}
                    onChange={(e) => setDraft(b.key, { isMonthly: e.target.checked })}
                  />
                  Monthly bucket
                </label>

                {isMonthly ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={label}>Monthly target</div>
                      <input
                        style={input}
                        inputMode="decimal"
                        value={monthlyTarget}
                        onChange={(e) => setDraft(b.key, { monthlyTarget: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <div style={label}>Due day (1-31)</div>
                      <input
                        style={input}
                        inputMode="numeric"
                        value={dueDay}
                        onChange={(e) => setDraft(b.key, { dueDay: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {showDebtFields ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 900, opacity: 0.8 }}>Debt details</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={label}>Balance</div>
                      <input
                        style={input}
                        inputMode="decimal"
                        value={balance}
                        onChange={(e) => setDraft(b.key, { balance: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <div style={label}>APR %</div>
                      <input
                        style={input}
                        inputMode="decimal"
                        value={apr}
                        onChange={(e) => setDraft(b.key, { apr: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={label}>Min payment</div>
                      <input
                        style={input}
                        inputMode="decimal"
                        value={minPayment}
                        onChange={(e) => setDraft(b.key, { minPayment: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <div style={label}>Credit limit</div>
                      <input
                        style={input}
                        inputMode="decimal"
                        value={creditLimit}
                        onChange={(e) => setDraft(b.key, { creditLimit: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {dirty ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  You have unsaved changes for this bucket.
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.55 }}>
                  Tip: Edit any field, then hit <b>Save</b>.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
