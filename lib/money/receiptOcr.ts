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

/** -----------------------------
 *  Receipt parsing (single)
 *  Basic parsing: tries to find TOTAL, DATE, and MERCHANT-ish.
 *  ES5-safe (no matchAll / iterator spread).
 * ----------------------------- */
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
    moneyRegex.lastIndex = 0; // reset because global regex
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

/** -----------------------------
 *  Screenshot parsing (multi)
 *  For bank/credit-card "Recent Transactions" screenshots.
 *  ES5-safe; returns multiple parsed items.
 * ----------------------------- */

export type ParsedTxn = {
  merchant: string;
  amount: number; // positive number
  direction: "debit" | "credit"; // debit = spend, credit = payment/credit
  dateText?: string; // e.g. "Mar 4, 2026, 12:45 PM"
  pending?: boolean;
};

/**
 * Parses OCR text from a "recent transactions" screenshot into multiple txns.
 * Works best on lists like:
 *   McDonald's        -$2.77
 *   Mar 4, 2026 ...   Pending
 */
export function parseTransactionsScreenshot(text: string): ParsedTxn[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Remove common noise lines that OCR picks up
  const lines = rawLines.filter((l) => {
    const lower = l.toLowerCase();
    if (lower === "recent transactions") return false;
    if (lower.startsWith("view all")) return false;
    if (/\bpts\b/i.test(l)) return false; // "20 pts"
    if (lower.includes("activate now")) return false;
    return true;
  });

  // Detect money amounts like -$2.77, +$37.97, $10.79, -10.79
  const amountRegex = /([+\-])?\s*\$?\s*(\d{1,4}(?:[,\s]\d{3})*(?:\.\d{2}))/;

  function parseAmount(line: string): { amount: number; direction: "debit" | "credit" } | null {
    const m = line.match(amountRegex);
    if (!m) return null;

    const sign = (m[1] || "").trim();
    const cleaned = (m[2] || "").replace(/\s/g, "").replace(/,/g, "");
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;

    // if OCR misses sign, we treat as debit by default
    const direction: "debit" | "credit" = sign === "+" ? "credit" : "debit";
    return { amount: n, direction };
  }

  function looksLikeDateLine(line: string): boolean {
    // e.g. "Mar 4, 2026, 12:45 PM" or "Feb 27, 2026"
    // Also catches numeric formats like 02/27/2026
    return (
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i.test(line) ||
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(line) ||
      /\b20\d{2}\b/.test(line)
    );
  }

  function looksLikeMerchantLine(line: string): boolean {
    // merchant line typically has letters and is not just a date
    if (!/[A-Za-z]/.test(line)) return false;
    if (looksLikeDateLine(line)) return false;
    // avoid lines that are clearly statuses
    const lower = line.toLowerCase();
    if (lower === "pending") return false;
    if (lower === "posted") return false;
    return true;
  }

  // Strategy:
  // 1) find lines that contain amounts
  // 2) for each amount line, search backward for merchant
  // 3) search forward/backward for date line
  const results: ParsedTxn[] = [];
  const usedMerchantIdx: Record<number, boolean> = {};

  for (let i = 0; i < lines.length; i++) {
    const amt = parseAmount(lines[i]);
    if (!amt) continue;

    // Find merchant line nearby (search backward up to 3 lines)
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

    // Find date line nearby (prefer next line after merchant)
    let dateText: string | undefined = undefined;
    let pending = false;

    // Look forward from merchant for up to 3 lines
    for (let j = merchantIdx + 1; j < lines.length && j <= merchantIdx + 3; j++) {
      if (looksLikeDateLine(lines[j])) {
        dateText = lines[j];
        break;
      }
      if (lines[j].toLowerCase().includes("pending")) pending = true;
    }

    // Also check the amount line itself for "pending"
    if (lines[i].toLowerCase().includes("pending")) pending = true;

    // De-dup protection: if OCR repeats the merchant line,
    // still allow if amount differs; otherwise skip exact duplicates.
    const key = `${merchant}|${amt.direction}|${amt.amount}|${dateText || ""}`;
    const already = results.some(
      (r) =>
        r.merchant === merchant &&
        r.direction === amt.direction &&
        Math.abs(r.amount - amt.amount) < 0.0001 &&
        (r.dateText || "") === (dateText || "")
    );
    if (already) continue;

    // Mark merchant idx used (helps if OCR repeats lines)
    if (merchantIdx >= 0) usedMerchantIdx[merchantIdx] = true;

    results.push({
      merchant,
      amount: amt.amount,
      direction: amt.direction,
      dateText,
      pending,
    });
  }

  // Sort by appearance order (already in order), but ensure stable output
  return results;
}

/**
 * Tiny merchant->category helper (optional).
 * You can expand this list anytime.
 */
export function guessCategoryFromMerchant(merchant: string): string {
  const m = merchant.toLowerCase();

  // Eating out
  if (m.includes("mcdonald") || m.includes("kfc") || m.includes("taco") || m.includes("pizza"))
    return "eating_out";

  // Gas
  if (m.includes("speedway") || m.includes("kwik") || m.includes("shell") || m.includes("bp"))
    return "gas";

  // Groceries / big box
  if (m.includes("target") || m.includes("walmart") || m.includes("aldi") || m.includes("costco"))
    return "groceries";

  // Default
  return "misc";
}
