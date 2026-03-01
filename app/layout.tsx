import "./globals.css";
import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Money Control Board",
  description: "Premium personal financial control dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          {/* Prevent content from hiding behind footer */}
          <div className="pb-20">{children}</div>
        </AppShell>

        {/* Persistent footer navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
