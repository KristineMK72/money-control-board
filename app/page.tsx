export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        background:
          "radial-gradient(900px 500px at 20% 10%, rgba(80,140,255,0.25), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(140,80,255,0.20), transparent 60%), #0b1020",
        color: "white",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ maxWidth: 920, width: "100%" }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 22,
            padding: 22,
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(255,255,255,0.10)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
              }}
            >
              $
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.6 }}>Money Control Board</h1>
              <div style={{ opacity: 0.8, marginTop: 6 }}>
                Stop reacting. Start assigning. Built for daily pay + real life.
              </div>
            </div>
          </div>

          <div style={{ height: 16 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <Feature title="Buckets" text="Fund essentials first, then goals." />
            <Feature title="Daily Pay" text="Log income and allocate instantly." />
            <Feature title="Calm" text="Turn chaos into a plan you can see." />
          </div>

          <div style={{ height: 18 }} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href="/money"
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "white",
                color: "#0b1020",
                fontWeight: 900,
                textDecoration: "none",
              }}
            >
              Open Dashboard →
            </a>

            <a
              href="/data"
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.22)",
                color: "white",
                fontWeight: 800,
                textDecoration: "none",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              Backup / Export
            </a>
          </div>

          <div style={{ height: 14 }} />
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Next up (SaaS mode): accounts + debt payoff + statement uploads.
          </div>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 18,
        padding: 14,
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.8 }}>{text}</div>
    </div>
  );
}
