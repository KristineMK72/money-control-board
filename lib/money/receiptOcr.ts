import { createWorker } from "tesseract.js";

/**
 * Run OCR on an image file (client-side).
 * Returns raw text + a rough confidence (0..1).
 */
export async function ocrImageFile(file: File): Promise<{ text: string; confidence: number }> {
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

  const merchant =
    lines.find((l) => /[A-Za-z]/.test(l) && l.length >= 3 && l.length <= 40) ||
    lines.find((l) => /[A-Za-z]/.test(l)) ||
    undefined;

  const dateISO = (() => {
    const iso = lines
      .map((l) => l.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/))
      .find(Boolean);
    if (iso) {
      const y = iso[1];
      const m = iso[2].padStart(2, "0");
      const d = iso[3].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const us = lines
      .map((l) => l.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})\b/))
      .find(Boolean);
    if (us) {
      const mm = us[1].padStart(2, "0");
      const dd = us[2].padStart(2, "0");
      const yy = us[3].length === 2 ? `20${us[3]}` : us[3];
      return `${yy}-${mm}-${dd}`;
    }

    return undefined;
  })();

  const moneyRegex = /(\$?\s*\d{1,4}(?:[,\s]\d{3})*(?:\.\d{2}))/g;

  function normalizeMoney(m: string): number | null {
    const cleaned = m.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  const totalKeywords = [
    "total",
    "amount due",
    "balance due",
    "grand total",
    "order total",
    "total due",
  ];

  let totalCandidates: number[] = [];

  for (const l of lines) {
    const lower = l.toLowerCase();
    if (!totalKeywords.some((k) => lower.includes(k))) continue;

    const matches = [...l.matchAll(moneyRegex)]
      .map((m) => normalizeMoney(m[1]))
      .filter((n): n is number => n != null);

    totalCandidates.push(...matches);
  }

  let total: number | undefined;

  if (totalCandidates.length) {
    total = totalCandidates[totalCandidates.length - 1];
  } else {
    const allMoney = lines
      .flatMap((l) => [...l.matchAll(moneyRegex)].map((m) => normalizeMoney(m[1])))
      .filter((n): n is number => n != null)
      .filter((n) => n > 0 && n < 10000);

    if (allMoney.length) total = Math.max(...allMoney);
  }

  return { merchant, dateISO, total };
}
