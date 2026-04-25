"use client";

import Link from "next/link";
import { Mountain, ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";

const KHAKI = "#4A6352";
const currentMonth = new Date().toLocaleString("en-US", { month: "long" }).toUpperCase();

export function Header() {
  const pathname = usePathname();
  const isRouteContext = pathname.startsWith("/route/");

  if (isRouteContext) {
    return (
      <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white/80 backdrop-blur-sm flex items-center px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-0.5 text-[var(--color-primary)] active:opacity-70 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          <span
            className="text-[0.9375rem] font-semibold"
            style={{ fontFamily: "var(--font-en)" }}
          >
            Home
          </span>
        </Link>
      </header>
    );
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white border-b border-gray-100 flex items-center px-4 shadow-sm">
      <Link
        href="/"
        className="inline-flex items-center gap-2 active:opacity-70 transition-opacity"
      >
        <Mountain
          className="w-5 h-5 text-[var(--color-primary)] shrink-0"
          strokeWidth={2}
        />
        <span
          className="text-[var(--color-primary)] font-semibold text-[15px] tracking-tight"
          style={{ fontFamily: "var(--font-en)" }}
        >
          Seoul Subway to Summit
        </span>
      </Link>
      <span
        className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.05em] border"
        style={{
          color: "#fff",
          borderColor: KHAKI,
          backgroundColor: KHAKI,
          fontFamily: "var(--font-en)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse inline-block shrink-0"
          style={{ backgroundColor: "#fff" }}
        />
        SEOUL, {currentMonth}
      </span>
    </header>
  );
}
