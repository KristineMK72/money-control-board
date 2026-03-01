import "./globals.css";
import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import AppShell from "@/components/AppShell";
import PageMotion from "@/components/PageMotion";

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
          <PageMotion>
            {/* Prevent content from hiding behind footer */}
            <div className="pb-20">{children}</div>
          </PageMotion>
        </AppShell>

        {/* Persistent footer navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
