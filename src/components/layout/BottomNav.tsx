"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mountain, Map, Info, Phone, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/",          icon: Mountain,   label: "Home",     exact: true  },
  { href: "/route",    icon: Map,        label: "Route",    exact: false },
  { href: "/info",     icon: Info,       label: "Info",     exact: false },
  { href: "/help",     icon: Phone,      label: "Help",     exact: false },
  { href: "/settings", icon: Settings,   label: "Settings", exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 h-16 bg-card border-t border-black/[0.06] dark:bg-card-dark dark:border-white/[0.06] flex items-stretch transition-all">
      {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 group transition-all"
          >
            <div
              className={[
                "px-5 py-1.5 rounded-full flex items-center justify-center transition-all duration-300",
                active
                  ? "bg-primary text-white shadow-md"
                  : "bg-transparent text-[var(--color-text-muted)] group-hover:text-[var(--fg)] group-hover:bg-black/[0.03] dark:group-hover:bg-white/[0.03]",
              ].join(" ")}
            >
              <Icon
                className="w-5 h-5 transition-transform"
                strokeWidth={active ? 2.5 : 2}
              />
            </div>
            <span
              className={[
                "text-[10px] tracking-tight transition-all",
                active
                  ? "text-primary font-bold scale-105"
                  : "text-[var(--color-text-muted)] font-medium",
              ].join(" ")}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
