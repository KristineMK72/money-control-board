"use client";

import React from "react";

export function btn(kind: "default" | "danger" = "default"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    cursor: "pointer",
    fontWeight: 900,
  };
  if (kind === "danger") return { ...base, border: "1px solid rgba(180,0,0,0.35)", color: "rgb(140,0,0)" };
  return base;
}

export function linkBtn(): React.CSSProperties {
  return { ...btn(), textDecoration: "none", display: "inline-block", color: "black" };
}

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>{title}</div>
      {subtitle ? <div style={{ opacity: 0.72, marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

export function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={styles.panel}>
      <div style={{ opacity: 0.72, fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 950 }}>{value}</div>
      {hint ? <div style={{ marginTop: 8, opacity: 0.72, fontSize: 13 }}>{hint}</div> : null}
    </div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.75)",
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.92,
      }}
    >
      {children}
    </span>
  );
}

export const styles: Record<string, React.CSSProperties> = {
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#eef4ff",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
  },
  input: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    background: "white",
  },
  label: { display: "grid", gap: 6, fontSize: 13, opacity: 0.96 },
  row: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" },
};
