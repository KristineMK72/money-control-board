"use client";

import React, { useMemo, useState } from "react";
import { ocrAndParse, type ParsedTxn } from "@/lib/money/ocr";
import { useMoneyStore } from "@/lib/money/store";
import type { BucketKey } from "@/lib/money/types";
import { btn } from "@/lib/money/ui";
import { fmt, todayISO } from "@/lib/money/utils";

type RowState = {
  selected: boolean;
  // for payments:
  bucketKey?: BucketKey;
  // for spend:
  includeAsSpend?: boolean;
};

function safeNumber(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default function TxnUploadReview() {
  const store = useMoneyStore();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [rawText, setRawText] = useState<string>("");
  const [txns, setTxns] = useState<ParsedTxn[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [notePrefix, setNotePrefix] = useState<string>("Screenshot import");

  // Choose a default “payment bucket” (credit/loan first; fallback to first bucket)
  const paymentBuckets = useMemo(() => {
    return (store.buckets || []).filter(
      (b: any) => b.kind === "credit" || b.kind === "loan"
    );
  }, [store.buckets]);

  const defaultPaymentBucketKey = useMemo<BucketKey | undefined>(() => {
    const first = paymentBuckets[0]?.key || store.buckets?.[0]?.key;
    return first as BucketKey | undefined;
  }, [paymentBuckets, store.buckets]);

  const totalsSelected = useMemo(() => {
    let payments = 0;
    let spends = 0;

    txns.forEach((t, idx) => {
      const r = rows[idx];
      if (!r?.selected) return;

      if (t.direction === "credit") payments += safeNumber(t.amount);
      else spends += safeNumber(t.amount);
    });

    return { payments, spends };
  }, [txns, rows]);

  const canAllocatePayments = useMemo(() => {
    // allocateAmount requires unassigned in your store
    return (store.totals?.unassigned ?? 0) >= totalsSelected.payments;
  }, [store.totals?.unassigned, totalsSelected.payments]);

  async function onRunOCR() {
    if (!file) return;
    setBusy(true);

    try {
      const result = await ocrAndParse(file, "transactions");
      setConfidence(result.confidence);
      setRawText(result.text);

      const parsed = result.parsed || [];
      setTxns(parsed);

      // Default row state:
      // - credits (payments) selected by default
      // - debits not selected (optional spend)
      const nextRows: Record<number, RowState> = {};
      parsed.forEach((t, idx) => {
        nextRows[idx] = {
          selected: t.direction === "credit",
          bucketKey: t.direction === "credit" ? defaultPaymentBucketKey : undefined,
          includeAsSpend: t.direction === "debit" ? false : undefined,
        };
      });
      setRows(nextRows);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(i: number) {
    setRows((prev) => ({
      ...prev,
      [i]: { ...(prev[i] || {}), selected: !prev[i]?.selected },
    }));
  }

  function setBucket(i: number, key: BucketKey) {
    setRows((prev) => ({
      ...prev,
      [i]: { ...(prev[i] || {}), bucketKey: key },
    }));
  }

  function toggleIncludeSpend(i: number) {
    setRows((prev) => ({
      ...prev,
      [i]: { ...(prev[i] || {}), includeAsSpend: !prev[i]?.includeAsSpend },
    }));
  }

  function selectAllCredits() {
    setRows((prev) => {
      const next = { ...prev };
      txns.forEach((t, idx) => {
        if (t.direction === "credit") {
          next[idx] = {
            ...(next[idx] || {}),
            selected: true,
            bucketKey: next[idx]?.bucketKey ?? defaultPaymentBucketKey,
          };
        }
      });
      return next;
    });
  }

  function clearAll() {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const i = Number(k);
        next[i] = { ...(next[i] || {}), selected: false };
      });
      return next;
    });
  }

  async function onSave() {
    // Save = allocate credits to buckets (payments)
    // Optional: log debits as spend (if your store supports addSpend)

    const anyStore = store as any;
    const hasAddSpend = typeof anyStore.addSpend === "function";

    // First, validate payment rows
    const paymentItems: Array<{ bucketKey: BucketKey; amount: number; merchant: string }> = [];
    const spendItems: Array<{ amount: number; merchant: string }> = [];

    txns.forEach((t, idx) => {
      const r = rows[idx];
      if (!r?.selected) return;

      if (t.direction === "credit") {
        const bk = (r.bucketKey || defaultPaymentBucketKey) as BucketKey | undefined;
        if (!bk) return;
        paymentItems.push({ bucketKey: bk, amount: safeNumber(t.amount), merchant: t.merchant });
      } else {
        // debit
        if (r.includeAsSpend && hasAddSpend) {
          spendItems.push({ amount: safeNumber(t.amount), merchant: t.merchant });
        }
      }
    });

    if (paymentItems.length === 0 && spendItems.length === 0) return;

    // If payments exceed unassigned, block for now (keeps math honest)
    const totalPayments = paymentItems.reduce((s, x) => s + x.amount, 0);
    if (totalPayments > 0 && !canAllocatePayments) {
      alert(
        `Not enough Unassigned to allocate payments.\n\nUnassigned: ${fmt(
          store.totals?.unassigned ?? 0
        )}\nPayments selected: ${fmt(totalPayments)}\n\nEither log income first, or we can add a dedicated “Payment (doesn't require income)” feature next.`
      );
      return;
    }

    // Apply payments
    for (const p of paymentItems) {
      store.allocateAmount(p.bucketKey, p.amount);
    }

    // Optional spends
    if (hasAddSpend) {
      for (const s of spendItems) {
        anyStore.addSpend({
          dateISO: todayISO(),
          amount: s.amount,
          category: "misc", // keep simple; you can enhance later
          note: `${notePrefix}: ${s.merchant}`,
        });
      }
    }

    // Clear selection after save
    clearAll();
    alert("Saved ✔");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>Import from screenshot</div>

      <div style={{ display: "grid", gap: 8 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onRunOCR} disabled={!file || busy} style={btn("primary")}>
            {busy ? "Reading…" : "Run OCR"}
          </button>

          <button onClick={selectAllCredits} disabled={!txns.length} style={btn()}>
            Select all payments
          </button>

          <button onClick={clearAll} disabled={!txns.length} style={btn()}>
            Clear selection
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Confidence: <b>{Math.round(confidence * 100)}%</b> · Unassigned:{" "}
          <b>{fmt(store.totals?.unassigned ?? 0)}</b>
        </div>
      </div>

      {txns.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>Parsed transactions</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Selected payments: <b>{fmt(totalsSelected.payments)}</b>
              {" · "}
              Selected spends: <b>{fmt(totalsSelected.spends)}</b>
            </div>
          </div>

          {!canAllocatePayments && totalsSelected.payments > 0 ? (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,0,0,0.12)",
                fontSize: 13,
              }}
            >
              Payments selected exceed Unassigned. Log income first (or we’ll add “payments without income” next).
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 8 }}>
            {txns.map((t, idx) => {
              const r = rows[idx] || { selected: false };
              const isPayment = t.direction === "credit";

              return (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(255,255,255,0.82)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
                      <input
                        type="checkbox"
                        checked={!!r.selected}
                        onChange={() => toggleSelected(idx)}
                      />
                      <span>{t.merchant}</span>
                    </label>

                    <div style={{ fontWeight: 900 }}>
                      {isPayment ? "+" : "-"} {fmt(t.amount)}
                    </div>
                  </div>

                  {t.dateText ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{t.dateText}</div>
                  ) : null}

                  {t.pending ? (
                    <div style={{ fontSize: 12, opacity: 0.7 }}>Pending</div>
                  ) : null}

                  {isPayment ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
                        Apply payment to bucket
                      </div>

                      <select
                        value={(r.bucketKey || defaultPaymentBucketKey || "") as any}
                        onChange={(e) => setBucket(idx, e.target.value as BucketKey)}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                        }}
                        disabled={!r.selected}
                      >
                        {(paymentBuckets.length ? paymentBuckets : store.buckets).map((b: any) => (
                          <option key={b.key} value={b.key}>
                            {b.name}
                          </option>
                        ))}
                      </select>

                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Uses <b>Allocate Unassigned</b> logic (so Unassigned must cover it).
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                        <input
                          type="checkbox"
                          checked={!!r.includeAsSpend}
                          onChange={() => toggleIncludeSpend(idx)}
                          disabled={!r.selected}
                        />
                        Also log as Spend (optional)
                      </label>
                      <span style={{ fontSize: 12, opacity: 0.65 }}>
                        (requires <code>addSpend</code> in store)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Spend note prefix (optional)
            </div>
            <input
              value={notePrefix}
              onChange={(e) => setNotePrefix(e.target.value)}
              placeholder="Screenshot import"
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            />
          </div>

          <button
            onClick={onSave}
            style={btn("primary")}
            disabled={
              busy ||
              (!txns.length) ||
              (!Object.values(rows).some((r) => r?.selected)) ||
              (!canAllocatePayments && totalsSelected.payments > 0)
            }
          >
            Save selected
          </button>

          <details style={{ opacity: 0.7 }}>
            <summary style={{ cursor: "pointer" }}>Show raw OCR text</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
              {rawText}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
