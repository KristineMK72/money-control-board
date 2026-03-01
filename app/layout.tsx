import "./globals.css";
import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";

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
        {/* Main app container */}
        <div className="min-h-screen pb-28">
          {children}
        </div>

        {/* Persistent footer nav */}
        <BottomNav />
      </body>
    </html>
  );
}
