"use client";

import React, { useEffect, useMemo, useState } from "react";

type BucketKey = string;

type Bucket = {
  key: BucketKey;
  name: string;
  target: number; // goal amount
  saved: number; // allocated so far
  due?: string;
  priority: 1 | 2 | 3; // 1 must, 2 important, 3 later
  focus?: boolean; // show in "Now → Mar 7"
};

type Entry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

const STORAGE_KEY = "money-control-board-v2";

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  const v = Math.round(n * 100) / 100;
  return Math.max(0, v);
}
function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function slugKey(name: string) {
  const base = (name || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "bucket";
}

export default function MoneyPage() {
  const [buckets, setBuckets] = useState<Bucket[]>([
    // Priority 1 (must)
    { key: "car", name: "Car Repair", target: 300, saved: 0, due: "ASAP (safety + income)", priority: 1, focus: true },
    { key: "insurance", name: "Insurance", target: 124, saved: 0, due: "before Feb 23", priority: 1, focus: true },
    { key: "power", name: "Crow Wing Power", target: 137, saved: 0, due: "ASAP", priority: 1, focus: true },
    { key: "collections", name: "$100 Before Collections", target: 100, saved: 0, due: "ASAP", priority: 1, focus: true },

    // Priority 2
    { key: "tsa", name: "TSA Temp 10-day", target: 45, saved: 0, due: "before Tues trip", priority: 2, focus: true },
    { key: "bill347", name: "Bill Due Mar 3", target: 347, saved: 0, due: "Mar 3", priority: 2, focus: true },
    { key: "cps", name: "CPS (negotiate / partial)", target: 632, saved: 0, due: "call Sunday", priority: 2, focus: true },
    { key: "verizon", name: "Verizon (one-time spike)", target: 320, saved: 0, due: "Feb 28", priority: 2, focus: true },
    { key: "varo", name: "Varo", target: 81, saved: 0, due: "Feb 28", priority: 2, focus: true },

    // Priority 3
    { key: "deb", name: "Deb (owed)", target: 500, saved: 0, due: "structured", priority: 3 },
    { key: "buffer", name: "Emergency Buffer", target: 500, saved: 0, due: "6-week goal", priority: 3 },
    { key: "gas", name: "Gas / Daily Needs", target: 0, saved: 0, due: "rolling", priority: 3 },
  ]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryDate, setEntryDate] = useState<string>(todayISO());
  const [entrySource, setEntrySource] = useState<Entry["source"]>("Salon");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryNote, setEntryNote] = useState<string>("");

  const [allocKey, setAllocKey] = useState<BucketKey>("insurance");
  const [allocAmt, setAllocAmt] = useState<number>(0);

  // Manage Buckets form
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState<number>(0);
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [newFocus, setNewFocus] = useState(true);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { buckets: Bucket[]; entries: Entry[] };
      if (parsed?.buckets?.length) setBuckets(parsed.buckets);
      if (parsed?.entries?.length) setEntries(parsed.entries);
    } catch {
      // ignore
    }
  }, []);

  // Save
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ buckets, entries }));
    } catch {
      // ignore
    }
  }, [buckets, entries]);

  const totals = useMemo(() => {
    const income = entries.reduce((s, e) => s + (e.amount || 0), 0);
    const allocated = entries.reduce((s, e) => {
      const a = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
      return s + a;
    }, 0);
    const unassigned = clampMoney(income - allocated);
    return { income: clampMoney(income), allocated: clampMoney(allocated), unassigned };
  }, [entries]);

  const bucketsByKey = useMemo(() => {
    const m = new Map<BucketKey, Bucket>();
    buckets.forEach((b) => m.set(b.key, b));
    return m;
  }, [buckets]);

  function recomputeBucketSaved(nextEntries: Entry[]) {
    const sums: Record<string, number> = {};
    for (const e of nextEntries) {
      for (const [k, v] of Object.entries(e.allocations || {})) {
        sums[k] = (sums[k] || 0) + (v || 0);
      }
    }
    setBuckets((prev) =>
      prev.map((b) => ({
        ...b,
        saved: clampMoney(sums[b.key] || 0),
      }))
    );
  }

  function addIncome() {
    const amt = clampMoney(entryAmount);
    if (amt <= 0) return;

    const newEntry: Entry = {
      id: uid(),
      dateISO: entryDate,
      source: entrySource,
      amount: amt,
      note: entryNote.trim() || undefined,
      allocations: {},
    };

    const next = [newEntry, ...entries].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    setEntries(next);
    setEntryAmount(0);
    setEntryNote("");
  }

  function allocateAmount(key: BucketKey, amount: number) {
    const amt = clampMoney(amount);
    if (amt <= 0) return;
    if (totals.unassigned < amt) return;

    const nextEntries = [...entries];
    let remaining = amt;

    for (const e of nextEntries) {
      const allocatedInEntry = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
      const room = clampMoney(e.amount - allocatedInEntry);
      if (room <= 0) continue;

      const take = clampMoney(Math.min(room, remaining));
      e.allocations = { ...(e.allocations || {}) };
      e.allocations[key] = clampMoney((e.allocations[key] || 0) + take);

      remaining = clampMoney(remaining - take);
      if (remaining <= 0) break;
    }

    if (remaining > 0) return;
    setEntries(nextEntries);
    recomputeBucketSaved(nextEntries);
  }

  function allocateUnassigned() {
    allocateAmount(allocKey, allocAmt);
    setAllocAmt(0);
  }

  function autoFundEssentials() {
    const order: BucketKey[] = ["insurance", "power", "car", "collections", "tsa", "bill347"];
    let unassigned = totals.unassigned;
    if (unassigned <= 0) return;

    for (const k of order) {
      const b = bucketsByKey.get(k);
      if (!b || b.target <= 0) continue;
      const remaining = clampMoney(Math.max(0, b.target - b.saved));
      if (remaining <= 0) continue;
      const pay = clampMoney(Math.min(unassigned, remaining));
      if (pay <= 0) continue;

      allocateAmount(k, pay);
      unassigned = clampMoney(unassigned - pay);
      if (unassigned <= 0) break;
    }
  }

  // --- Manage Buckets actions ---
  function updateBucket(key: BucketKey, patch: Partial<Bucket>) {
    setBuckets((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch, target: clampMoney(patch.target ?? b.target) } : b))
    );
  }

  function removeBucket(key: BucketKey) {
    const ok = confirm("Delete this bucket? (Existing allocations will remain in history but won't map to a bucket.)");
    if (!ok) return;
    setBuckets((prev) => prev.filter((b) => b.key !== key));
  }

  function addBucket() {
    const name = newName.trim();
    if (!name) return;

    const baseKey = slugKey(name);
    let key = baseKey;
    let i = 2;
    while (buckets.some((b) => b.key === key)) {
      key = `${baseKey}-${i++}`;
    }

    const bucket: Bucket = {
      key,
      name,
      target: clampMoney(newTarget),
      saved: 0,
      due: newDue.trim() || undefined,
      priority: newPriority,
      focus: newFocus,
    };

    setBuckets((prev) => [bucket, ...prev]);
    setNewName("");
    setNewTarget(0);
    setNewDue("");
    setNewPriority(2);
    setNewFocus(true);
  }

  function resetAll() {
    const ok = confirm("Reset this board (entries + allocations) on this device?");
    if (!ok) return;
    setEntries([]);
    setBuckets((prev) => prev.map((b) => ({ ...b, saved: 0 })));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const focusBuckets = useMemo(() => buckets.filter((b) => b.focus), [buckets]);
  const otherBuckets = useMemo(() => buckets.filter((b) => !b.focus), [buckets]);

  const grouped = useMemo(() => {
    const byDate = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = byDate.get(e.dateISO) || [];
      arr.push(e);
      byDate.set(e.dateISO, arr);
    }
    const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));
    return { byDate, dates };
  }, [entries]);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Money Control Board</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Focus: <b>Now → March 7</b> · Fund buckets, not stress.
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/data" style={linkBtn()}>View /data (export/import)</a>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={autoFundEssentials} style={btn()}>
            Auto-Fund Essentials
          </button>
          <button onClick={resetAll} style={btn("danger")}>
            Reset
          </button>
        </div>
      </header>

      <div style={styles.summaryGrid}>
        <SummaryCard title="Income Logged" value={fmt(totals.income)} />
        <SummaryCard title="Allocated" value={fmt(totals.allocated)} />
        <SummaryCard title="Unassigned" value={fmt(totals.unassigned)} />
      </div>

      <Section title="Now → Mar 7 Buckets" subtitle="Only what matters before March 7." />
      <div style={styles.bucketGrid}>
        {focusBuckets
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((b) => (
            <BucketCard key={b.key} bucket={b} />
          ))}
      </div>

      <Section title="Later Buckets" subtitle="These matter after the urgent stuff is covered." />
      <div style={styles.bucketGrid}>
        {otherBuckets
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((b) => (
            <BucketCard key={b.key} bucket={b} />
          ))}
      </div>

      <Section title="Log Income" subtitle="Add your daily pay, DoorDash, or any deposit." />
      <div style={styles.formRow}>
        <label style={styles.label}>
          Date
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Source
          <select value={entrySource} onChange={(e) => setEntrySource(e.target.value as any)} style={styles.input}>
            <option>Salon</option>
            <option>DoorDash</option>
            <option>Other</option>
          </select>
        </label>

        <label style={styles.label}>
          Amount
          <input
            inputMode="decimal"
            value={entryAmount ? String(entryAmount) : ""}
            onChange={(e) => setEntryAmount(Number(e.target.value))}
            placeholder="0"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Note (optional)
          <input value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder="e.g., lunch shift" style={styles.input} />
        </label>

        <button onClick={addIncome} style={btn()} disabled={clampMoney(entryAmount) <= 0}>
          Add
        </button>
      </div>

      <Section title="Allocate Unassigned" subtitle="Put money into a bucket once you’ve logged income." />
      <div style={styles.allocRow}>
        <label style={styles.label}>
          Bucket
          <select value={allocKey} onChange={(e) => setAllocKey(e.target.value as BucketKey)} style={styles.input}>
            {buckets.map((b) => {
              const left = b.target > 0 ? Math.max(0, b.target - b.saved) : 0;
              return (
                <option key={b.key} value={b.key}>
                  {b.name}
                  {b.target > 0 ? ` — ${fmt(left)} left` : ""}
                </option>
              );
            })}
          </select>
        </label>

        <label style={styles.label}>
          Amount (≤ unassigned)
          <input
            inputMode="decimal"
            value={allocAmt ? String(allocAmt) : ""}
            onChange={(e) => setAllocAmt(Number(e.target.value))}
            placeholder="0"
            style={styles.input}
          />
        </label>

        <button onClick={allocateUnassigned} style={btn()} disabled={clampMoney(allocAmt) <= 0 || totals.unassigned < clampMoney(allocAmt)}>
          Allocate
        </button>
      </div>

      <Section title="Manage Buckets" subtitle="Add, edit, or delete buckets (bills, goals, categories)." />
      <div style={styles.panel}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Add a bucket</div>
          <div style={styles.manageRow}>
            <label style={styles.label}>
              Name
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Groceries" style={styles.input} />
            </label>
            <label style={styles.label}>
              Target (optional)
              <input
                inputMode="decimal"
                value={newTarget ? String(newTarget) : ""}
                onChange={(e) => setNewTarget(Number(e.target.value))}
                placeholder="0"
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Due (optional)
              <input value={newDue} onChange={(e) => setNewDue(e.target.value)} placeholder="e.g., Mar 15" style={styles.input} />
            </label>
            <label style={styles.label}>
              Priority
              <select value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value) as any)} style={styles.input}>
                <option value={1}>1 (Must)</option>
                <option value={2}>2 (Important)</option>
                <option value={3}>3 (Later)</option>
              </select>
            </label>
            <label style={{ ...styles.label, alignSelf: "end" }}>
              <span>Show in Focus</span>
              <input type="checkbox" checked={newFocus} onChange={(e) => setNewFocus(e.target.checked)} />
            </label>

            <button onClick={addBucket} style={btn()} disabled={!newName.trim()}>
              Add Bucket
            </button>
          </div>

          <div style={{ marginTop: 10, fontWeight: 900 }}>Edit existing buckets</div>
          <div style={{ display: "grid", gap: 10 }}>
            {buckets.map((b) => (
              <div key={b.key} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                  <label style={styles.label}>
                    Name
                    <input value={b.name} onChange={(e) => updateBucket(b.key, { name: e.target.value })} style={styles.input} />
                  </label>
                  <label style={styles.label}>
                    Target
                    <input
                      inputMode="decimal"
                      value={b.target ? String(b.target) : ""}
                      onChange={(e) => updateBucket(b.key, { target: Number(e.target.value) })}
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.label}>
                    Due
                    <input value={b.due ?? ""} onChange={(e) => updateBucket(b.key, { due: e.target.value })} style={styles.input} />
                  </label>
                  <label style={styles.label}>
                    Priority
                    <select value={b.priority} onChange={(e) => updateBucket(b.key, { priority: Number(e.target.value) as any })} style={styles.input}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>

                  <label style={{ ...styles.label, alignSelf: "end" }}>
                    <span>Focus</span>
                    <input type="checkbox" checked={!!b.focus} onChange={(e) => updateBucket(b.key, { focus: e.target.checked })} />
                  </label>

                  <button onClick={() => removeBucket(b.key)} style={btn("danger")}>
                    Delete
                  </button>
                </div>

                <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
                  Key: <code>{b.key}</code> · Saved: <b>{fmt(b.saved)}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Section title="Entries (by day)" subtitle="Your log, grouped by date." />
      <div style={{ display: "grid", gap: 12 }}>
        {grouped.dates.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No entries yet. Add income above, then allocate to buckets.</div>
        ) : (
          grouped.dates.map((d) => (
            <div key={d} style={styles.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>{d}</div>
                <div style={{ opacity: 0.75 }}>
                  Day total:{" "}
                  {fmt(
                    grouped.byDate
                      .get(d)!
                      .reduce((s, e) => s + e.amount, 0)
                  )}
                </div>
              </div>

              {grouped.byDate.get(d)!.map((e) => {
                const allocatedInEntry = Object.values(e.allocations || {}).reduce((x, v) => x + (v || 0), 0);
                const room = clampMoney(e.amount - allocatedInEntry);
                return (
                  <div key={e.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10, marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <b>{e.source}</b> · {fmt(e.amount)} {e.note ? <span style={{ opacity: 0.75 }}>— {e.note}</span> : null}
                      </div>
                      <div style={{ opacity: 0.75 }}>Unallocated: {fmt(room)}</div>
                    </div>

                    {Object.keys(e.allocations || {}).length > 0 && (
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {Object.entries(e.allocations).map(([k, v]) => {
                          const b = bucketsByKey.get(k as BucketKey);
                          return (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ opacity: 0.9 }}>{b?.name ?? k}</div>
                              <div style={{ fontWeight: 700 }}>{fmt(v || 0)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <footer style={{ marginTop: 24, opacity: 0.7, fontSize: 13 }}>
        Tip: Log income → then <b>Auto-Fund Essentials</b>. For backup or moving devices, use <b>/data</b> export.
      </footer>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.7, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

function BucketCard({ bucket }: { bucket: Bucket }) {
  const target = bucket.target;
  const saved = bucket.saved;
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const remaining = target > 0 ? Math.max(0, target - saved) : 0;

  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>
          {bucket.name}{" "}
          <span style={{ fontWeight: 700, opacity: 0.6 }}>
            (P{bucket.priority}){bucket.due ? ` · ${bucket.due}` : ""}
          </span>
        </div>
        <div style={{ fontWeight: 900 }}>{target > 0 ? `${fmt(saved)} / ${fmt(target)}` : fmt(saved)}</div>
      </div>

      {target > 0 ? (
        <>
          <div style={{ height: 10 }} />
          <div style={{ height: 10, background: "rgba(0,0,0,0.08)", borderRadius: 999 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "rgba(0,0,0,0.55)", borderRadius: 999 }} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12, opacity: 0.75 }}>
            <div>{pct}%</div>
            <div>Remaining: {fmt(remaining)}</div>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 8, opacity: 0.75 }}>Rolling bucket (no fixed target)</div>
      )}
    </div>
  );
}

function btn(kind: "default" | "danger" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  };
  if (kind === "danger") return { ...base, border: "1px solid rgba(180,0,0,0.35)", color: "rgb(140,0,0)" };
  return base;
}

function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#f5f5f5",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 14,
    background: "white",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  bucketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "white",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr 1fr 2fr auto",
    gap: 8,
    alignItems: "end",
  },
  allocRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr auto",
    gap: 8,
    alignItems: "end",
  },
  manageRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto auto",
    gap: 8,
    alignItems: "end",
  },
  label: { display: "grid", gap: 6, fontSize: 13, opacity: 0.95 },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    background: "white",
  },
};
