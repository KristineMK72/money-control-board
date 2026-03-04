import { createWorker } from "tesseract.js";

/**
 * Run OCR on an image file (client-side).
 * Returns raw text + a rough confidence (0..1).
 */
export async function ocrImageFile(
  file: File
): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    const text = (data.text || "").trim();
    const confidence =
      typeof data.confidence === "number"
        ? Math.max(0, Math.min(1, data.confidence / 100))
        : 0;
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

/**
 * Basic parsing: tries to find TOTAL, DATE, and MERCHANT-ish.
 * ES5-safe (no matchAll / iterator spread).
 */
export function parseReceiptText(text: string): {
  merchant?: string;
  dateISO?: string;
  total?: number;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Merchant guess: first reasonable text line
  const merchant =
    lines.find((l) => /[A-Za-z]/.test(l) && l.length >= 3 && l.length <= 40) ||
    lines.find((l) => /[A-Za-z]/.test(l)) ||
    undefined;

  // Date guess: 2026-03-04 or 03/04/2026
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

  // Money parsing helpers
  const moneyRegex = /(\$?\s*\d{1,4}(?:[,\s]\d{3})*(?:\.\d{2}))/g;

  function normalizeMoney(m: string): number | null {
    const cleaned = m.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function extractMoneyValues(line: string): number[] {
    const out: number[] = [];
    // IMPORTANT: reset lastIndex because regex is global
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
    // typically last number on "TOTAL" line
    total = totalCandidates[totalCandidates.length - 1];
  } else {
    // fallback: pick largest plausible money number on receipt
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
