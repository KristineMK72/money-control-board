"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/money", label: "Board" },
  { href: "/money/bills", label: "Bills" },
  { href: "/spend", label: "Spend" },
  { href: "/money/income", label: "Income" },
  { href: "/money/plan", label: "Plan" },
  { href: "/money/add", label: "Add/Edit" },
  { href: "/forecast", label: "Forecast" },
  { href: "/crisis", label: "Crisis" }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/40 backdrop-blur-xl"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)" }}
    >
      <div className="mx-auto max-w-3xl px-3 pt-2 pb-2">
        <div className="relative">
          {/* left/right fade so it feels scrollable */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-black/40 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-black/40 to-transparent" />

          <div
            className="flex gap-2 overflow-x-auto no-scrollbar py-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition",
                    "active:scale-[0.98]",
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
      </div>
    </nav>
  );
}
