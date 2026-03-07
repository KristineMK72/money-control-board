"use client";

import React, { useMemo, useState } from "react";
import { useMoneyStore } from "@/lib/money/store";
import type { Bucket } from "@/lib/money/types";
import { fmt } from "@/lib/money/utils";
import {
  MoneyShell,
  Section,
  SummaryRow,
  SummaryCard,
} from "@/lib/money/ui";

function remainingForBucket(bucket: Bucket) {
  const target = Number(bucket.target || 0);
  const saved = Number(bucket.saved || 0);
  return Math.max(0, target - saved);
}

function BillAllocateCard({
  bucket,
  available,
  onAllocate,
}: {
  bucket: Bucket;
  available: number;
  onAllocate: (bucketKey: string, amount: number) => void;
}) {
  const remaining = remainingForBucket(bucket);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(remaining > 0 ? remaining : 0);

  const canAllocate =
    available > 0 && remaining > 0 && Number(amount || 0) > 0;

  const quickAmount = Math.min(remaining, available);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(10px)",
        display: "grid",
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{bucket.name}</div>
            <div style={{ opacity: 0.72, fontSize: 13 }}>
              {bucket.due || (bucket.dueDate ? `Due: ${bucket.dueDate}` : "No due date set")}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Priority</div>
            <div style={{ fontWeight: 700 }}>{bucket.priority ?? "—"}</div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              borderRadius: 14,
              padding: 10,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>Target</div>
            <div style={{ fontWeight: 700 }}>{fmt(bucket.target || 0)}</div>
          </div>

          <div
            style={{
              borderRadius: 14,
              padding: 10,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>Saved</div>
            <div style={{ fontWeight: 700 }}>{fmt(bucket.saved || 0)}</div>
          </div>

          <div
            style={{
              borderRadius: 14,
              padding: 10,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>Remaining</div>
            <div style={{ fontWeight: 700 }}>{fmt(remaining)}</div>
          </div>
        </div>
      </button>

      {open && (
        <div
          style={{
            marginTop: 4,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 12,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Available to allocate: <strong>{fmt(available)}</strong>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setAmount(Math.min(25, remaining, available))}
              style={quickBtnStyle}
            >
              +$25
            </button>
            <button
              type="button"
              onClick={() => setAmount(Math.min(50, remaining, available))}
              style={quickBtnStyle}
            >
              +$50
            </button>
            <button
              type="button"
              onClick={() => setAmount(Math.min(100, remaining, available))}
              style={quickBtnStyle}
            >
              +$100
            </button>
            <button
              type="button"
              onClick={() => setAmount(quickAmount)}
              style={quickBtnStyle}
            >
              Fill Remaining
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              style={{
                minWidth: 140,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "inherit",
              }}
            />

            <button
              type="button"
              disabled={!canAllocate}
              onClick={() => {
                const amt = Math.min(Number(amount || 0), available, remaining);
                if (amt <= 0) return;
                onAllocate(bucket.key, amt);
                setAmount(Math.max(0, remaining - amt));
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: canAllocate ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                color: "inherit",
                cursor: canAllocate ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Allocate to {bucket.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const quickBtnStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  cursor: "pointer",
};

export default function BillsDebtPage() {
  const store = useMoneyStore();
  const { buckets, totals } = store;

  const focus = useMemo(() => buckets.filter((b) => b.focus), [buckets]);
  const other = useMemo(() => buckets.filter((b) => !b.focus), [buckets]);

  const totalRemaining = useMemo(() => {
    return buckets.reduce((sum, b) => sum + remainingForBucket(b), 0);
  }, [buckets]);

  const onAllocate = (bucketKey: string, amount: number) => {
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) return;
    store.allocateAmount(bucketKey as any, amt);
  };

  return (
    <MoneyShell
      title="Bills / Debt"
      subtitle="See balances and allocate directly from available income."
    >
      <SummaryRow>
        <SummaryCard
          title="Available Income"
          value={fmt(totals.unassigned)}
          hint="This comes from the Income page."
        />
        <SummaryCard
          title="Already Allocated"
          value={fmt(totals.allocated)}
        />
        <SummaryCard
          title="Still Needed"
          value={fmt(totalRemaining)}
          hint="Total remaining across all buckets."
        />
      </SummaryRow>

      <Section title="Focus Buckets" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {focus.map((b) => (
          <BillAllocateCard
            key={b.key}
            bucket={b}
            available={totals.unassigned}
            onAllocate={onAllocate}
          />
        ))}
      </div>

      <Section title="Other Buckets" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {other.map((b) => (
          <BillAllocateCard
            key={b.key}
            bucket={b}
            available={totals.unassigned}
            onAllocate={onAllocate}
          />
        ))}
      </div>
    </MoneyShell>
  );
}
