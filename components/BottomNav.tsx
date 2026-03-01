"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/money", label: "Board" },
  { href: "/money/bills", label: "Bills" },
  { href: "/money/income", label: "Income" },
  { href: "/money/plan", label: "Plan" },
  { href: "/money/add", label: "Add/Edit" },
  { href: "/forecast", label: "Forecast" }, // optional but nice
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
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-semibold transition",
                active ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <span className={["mb-1 h-1 w-6 rounded-full", active ? "bg-white/80" : "bg-transparent"].join(" ")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
