import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(120,140,255,0.18),transparent_60%),radial-gradient(900px_500px_at_90%_20%,rgba(90,220,255,0.10),transparent_60%),linear-gradient(180deg,#070814, #0a0b18_45%, #070814)] text-white">
      {/* iOS safe area top */}
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5">
        {children}
      </div>

      {/* iOS safe area bottom handled by BottomNav */}
    </div>
  );
}
