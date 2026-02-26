import type { Bucket } from "./types";

export function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * 100) / 100;
  return Math.max(0, v);
}

export function clampPercent(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * 100) / 100;
  return Math.max(0, v);
}

export function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function monthKeyFromISO(iso: string) {
  return iso.slice(0, 7);
}

export function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

export function slugKey(name: string) {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "bucket";
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekISO(iso: string) {
  // Monday start
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun..6 Sat
  const mondayOffset = (day + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

export function endOfWeekISO(iso: string) {
  return addDaysISO(startOfWeekISO(iso), 6);
}

export function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function clampDayOfMonth(d: number) {
  if (!Number.isFinite(d)) return 1;
  return Math.min(31, Math.max(1, Math.floor(d)));
}

export function dueDateForNextOccurrence(nowISO: string, dueDay: number) {
  const now = new Date(nowISO + "T00:00:00");
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const day = clampDayOfMonth(dueDay);

  if (today <= day) {
    const d = new Date(Date.UTC(y, m, day));
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(Date.UTC(y, m + 1, day));
  return d.toISOString().slice(0, 10);
}

export function applyMonthlyAutoAdd(nowISO: string, buckets: Bucket[]) {
  return buckets.map((b) => {
    if (!b.isMonthly) return b;
    const monthlyTarget = clampMoney(b.monthlyTarget ?? b.target);
    const dueDay = clampDayOfMonth(b.dueDay ?? 1);
    const dueDate = dueDateForNextOccurrence(nowISO, dueDay);
    return { ...b, target: monthlyTarget, dueDate };
  });
}
