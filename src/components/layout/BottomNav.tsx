"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Map, Info, Phone, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/hiking",          icon: House,      label: "Home",     exact: true  },
  { href: "/hiking/route",    icon: Map,        label: "Route",    exact: false },
  { href: "/hiking/info",     icon: Info,       label: "Info",     exact: false },
  { href: "/hiking/help",     icon: Phone,      label: "Help",     exact: false },
  { href: "/hiking/settings", icon: Settings,   label: "Settings", exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 h-16 bg-card border-t border-black/[0.06] dark:bg-card-dark dark:border-white/[0.06] flex items-stretch">
      {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex-1 flex flex-col items-center justify-center gap-[2px] transition-colors",
              active
                ? "text-primary"
                : "text-[var(--color-text-muted)] hover:text-[var(--fg)]",
            ].join(" ")}
          >
            <Icon
              className="w-[22px] h-[22px]"
              strokeWidth={active ? 2.5 : 2}
            />
            <span className="text-[11px] font-medium leading-none">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
