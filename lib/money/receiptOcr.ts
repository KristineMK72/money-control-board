// lib/money/ocr.ts
"use client";

import { createWorker, type Worker } from "tesseract.js";

/* ============================
   Worker singleton (reuse)
============================ */

let workerPromise: Promise<Worker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker("eng");
      return w;
    })();
  }
  return workerPromise;
}

export async function terminateWorker() {
  if (!workerPromise) return;
  const w = await workerPromise;
  await w.terminate();
  workerPromise = null;
}

/* ============================
   OCR
============================ */

export async function ocrImageFile(
  file: File
): Promise<{ text: string; confidence: number }> {
  const w = await getWorker();
  const { data } = await w.recognize(file);
  const text = (data.text || "").trim();
  const confidence =
    typeof data.confidence === "number"
      ? Math.max(0, Math.min(1, data.confidence / 100))
      : 0;
  return { text, confidence };
}

/* ============================
   Receipt parsing (single)
============================ */

export function parseReceiptText(text: string): {
  merchant?: string;
  dateISO?: string;
  total?: number;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => (l || "").trim())
    .filter(Boolean);

  const merchant =
    lines.find((l) => /[A-Za-z]/.test(l) && l.length >= 3 && l.length <= 40) ||
    lines.find((l) => /[A-Za-z]/.test(l)) ||
    undefined;

  const dateISO = (() => {
    for (const l of lines) {
      const iso = l.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
      if (iso) {
        const y = iso[1];
        const m = iso[2].padStart(2, "0");
        const d = iso[3].padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
    for (const l of lines) {
      const us = l.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})\b/);
      if (us) {
        const mm = us[1].padStart(2, "0");
        const dd = us[2].padStart(2, "0");
        const yy = us[3].length === 2 ? `20${us[3]}` : us[3];
        return `${yy}-${mm}-${dd}`;
      }
    }
    return undefined;
  })();

  const moneyRegex = /(\$?\s*\d{1,4}(?:[,\s]\d{3})*(?:\.\d{2}))/g;

  function normalizeMoney(m: string): number | null {
    const cleaned = m.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function extractMoneyValues(line: string): number[] {
    const out: number[] = [];
    moneyRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = moneyRegex.exec(line)) !== null) {
      const n = normalizeMoney(match[1]);
      if (n != null) out.push(n);
    }
    return out;
  }

  const totalKeywords = [
    "total",
    "amount due",
    "balance due",
    "grand total",
    "order total",
    "total due",
  ];

  const totalCandidates: number[] = [];

  for (const l of lines) {
    const lower = l.toLowerCase();
    let isTotalLine = false;
    for (const k of totalKeywords) {
      if (lower.includes(k)) {
        isTotalLine = true;
        break;
      }
    }
    if (!isTotalLine) continue;

    const vals = extractMoneyValues(l);
    for (const v of vals) totalCandidates.push(v);
  }

  let total: number | undefined;

  if (totalCandidates.length) {
    total = totalCandidates[totalCandidates.length - 1];
  } else {
    const allMoney: number[] = [];
    for (const l of lines) {
      const vals = extractMoneyValues(l);
      for (const v of vals) {
        if (v > 0 && v < 10000) allMoney.push(v);
      }
    }
    if (allMoney.length) total = Math.max.apply(null, allMoney);
  }

  return { merchant, dateISO, total };
}

/* ============================
   Transactions screenshot (multi)
============================ */

export type ParsedTxn = {
  merchant: string;
  amount: number;
  direction: "debit" | "credit";
  dateText?: string;
  pending?: boolean;
};

export function parseTransactionsScreenshot(text: string): ParsedTxn[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => (l || "").trim())
    .filter(Boolean);

  const lines = rawLines.filter((l) => {
    const lower = l.toLowerCase();
    if (lower === "recent transactions") return false;
    if (lower.startsWith("view all")) return false;
    if (/\bpts\b/i.test(l)) return false;
    if (lower.includes("activate now")) return false;
    return true;
  });

  const amountRegex = /([+\-])?\s*\$?\s*(\d{1,4}(?:[,\s]\d{3})*(?:\.\d{2}))/;

  function parseAmount(
    line: string
  ): { amount: number; direction: "debit" | "credit" } | null {
    const m = line.match(amountRegex);
    if (!m) return null;

    const sign = (m[1] || "").trim();
    const cleaned = (m[2] || "").replace(/\s/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;

    const direction: "debit" | "credit" = sign === "+" ? "credit" : "debit";
    return { amount: n, direction };
  }

  function looksLikeDateLine(line: string): boolean {
    return (
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i.test(line) ||
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(line) ||
      /\b20\d{2}\b/.test(line)
    );
  }

  function looksLikeMerchantLine(line: string): boolean {
    if (!/[A-Za-z]/.test(line)) return false;
    if (looksLikeDateLine(line)) return false;
    const lower = line.toLowerCase();
    if (lower === "pending" || lower === "posted") return false;
    return true;
  }

  const results: ParsedTxn[] = [];

  for (let i = 0; i < lines.length; i++) {
    const amt = parseAmount(lines[i]);
    if (!amt) continue;

    let merchant = "";
    let merchantIdx = -1;

    for (let j = i; j >= 0 && j >= i - 3; j--) {
      if (looksLikeMerchantLine(lines[j])) {
        merchant = lines[j];
        merchantIdx = j;
        break;
      }
    }
    if (!merchant) continue;

    let dateText: string | undefined = undefined;
    let pending = false;

    for (let j = merchantIdx + 1; j < lines.length && j <= merchantIdx + 3; j++) {
      if (looksLikeDateLine(lines[j])) {
        dateText = lines[j];
        break;
      }
      if (lines[j].toLowerCase().includes("pending")) pending = true;
    }

    if (lines[i].toLowerCase().includes("pending")) pending = true;

    const already = results.some(
      (r) =>
        r.merchant === merchant &&
        r.direction === amt.direction &&
        Math.abs(r.amount - amt.amount) < 0.0001 &&
        (r.dateText || "") === (dateText || "")
    );
    if (already) continue;

    results.push({
      merchant,
      amount: amt.amount,
      direction: amt.direction,
      dateText,
      pending,
    });
  }

  return results;
}

/* ============================
   One-call helpers for UI
============================ */

export type OCRMode = "receipt" | "transactions";

export async function ocrAndParse(
  file: File,
  mode: OCRMode
): Promise<
  | { mode: "receipt"; text: string; confidence: number; parsed: ReturnType<typeof parseReceiptText> }
  | { mode: "transactions"; text: string; confidence: number; parsed: ParsedTxn[] }
> {
  const { text, confidence } = await ocrImageFile(file);

  if (mode === "receipt") {
    return { mode, text, confidence, parsed: parseReceiptText(text) };
  }

  return { mode, text, confidence, parsed: parseTransactionsScreenshot(text) };
}
