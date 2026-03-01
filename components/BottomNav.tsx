"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/money", label: "Board" },
  { href: "/money/bills", label: "Bills" },
  { href: "/money/income", label: "Income" },
  { href: "/money/plan", label: "Plan" },
  { href: "/money/add", label: "Add/Edit" },
  { href: "/forecast", label: "Forecast" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/40 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* horizontally scrollable row */}
      <div className="mx-auto max-w-3xl px-3 py-2">
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition",
                  active
                    ? "bg-white/18 text-white"
                    : "bg-white/8 text-white/70 hover:bg-white/12 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
