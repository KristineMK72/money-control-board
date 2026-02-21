"use client";

import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "money-control-board-v2";

type BucketKey = string;

type Bucket = {
  key: BucketKey;
  name: string;
  target: number;
  saved: number;
  due?: string;
  priority: 1 | 2 | 3;
  focus?: boolean;
};

type Entry = {
  id: string;
  dateISO: string;
  source: "Salon" | "DoorDash" | "Other";
  amount: number;
  note?: string;
  allocations: Record<string, number>;
};

type StoreShape = {
  buckets: Bucket[];
  entries: Entry[];
};

function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

export default function DataPage() {
  const [store, setStore] = useState<StoreShape>({ buckets: [], entries: [] });
  const [importText, setImportText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setStore(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const exportJson = useMemo(() => JSON.stringify(store, null, 2), [store]);

  function refresh() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setStore(JSON.parse(raw));
    } catch {
      // ignore
    }
  }

  function downloadJson() {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "money-control-board-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    try {
      const parsed = JSON.parse(importText) as StoreShape;
      if (!parsed?.buckets || !parsed?.entries) {
        alert("That JSON does not look like Money Control Board data.");
        return;
      }
      // Clamp money fields for safety
      parsed.buckets = parsed.buckets.map((b) => ({ ...b, target: clampMoney(b.target), saved: clampMoney(b.saved) }));
      parsed.entries = parsed.entries.map((e) => ({ ...e, amount: clampMoney(e.amount) }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      setStore(parsed);
      setImportText("");
      alert("Imported successfully!");
    } catch {
      alert("Import failed: invalid JSON.");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Data</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        This shows everything saved on <b>this device</b> (localStorage).
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="/money" style={linkBtn()}>← Back to /money</a>
        <button onClick={refresh} style={btn()}>Refresh</button>
        <button onClick={downloadJson} style={btn()}>Export JSON</button>
      </div>

      <h2 style={{ marginTop: 18 }}>Quick counts</h2>
      <div style={panel()}>
        <div><b>Buckets:</b> {store.buckets.length}</div>
        <div><b>Entries:</b> {store.entries.length}</div>
      </div>

      <h2 style={{ marginTop: 18 }}>Export preview</h2>
      <pre style={{ ...panel(), overflowX: "auto", whiteSpace: "pre" }}>{exportJson}</pre>

      <h2 style={{ marginTop: 18 }}>Import (paste JSON here)</h2>
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder='Paste exported JSON here…'
        style={{ ...panel(), width: "100%", minHeight: 160, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={importJson} style={btn()} disabled={!importText.trim()}>
          Import JSON
        </button>
      </div>
    </div>
  );
}

function panel(): React.CSSProperties {
  return { border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "white" };
}
function btn(): React.CSSProperties {
  return { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.18)", background: "white", fontWeight: 800 };
}
function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
}
