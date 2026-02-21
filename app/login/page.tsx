"use client";

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Login</h1>
      <p style={{ opacity: 0.75 }}>
        Coming next: Cloud Mode using Supabase Auth (email login).
      </p>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, background: "white" }}>
        <p style={{ marginTop: 0 }}>
          For now, use <b>Local Mode</b> on <code>/money</code>.
        </p>
        <a href="/money" style={btnLink()}>Go to Dashboard →</a>
      </div>
    </main>
  );
}

function btnLink(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
    textDecoration: "none",
    color: "black",
  };
}
