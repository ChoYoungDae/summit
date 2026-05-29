"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
  const isRouteContext = pathname.startsWith("/route/");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isRouteContext) {
    return (
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 h-14 bg-white/80 dark:bg-card-dark/80 backdrop-blur-sm flex items-center px-4 transition-all">
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
    <header
      className={`fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 h-14 flex items-center px-4 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 dark:bg-card-dark/95 backdrop-blur-md border-b border-gray-100/60 shadow-sm"
          : "bg-[#F7F7FA] dark:bg-card-dark"
      }`}
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1 active:opacity-70 transition-opacity"
      >
        <Image
          src="/images/S2S.png"
          alt="S2S"
          width={30}
          height={30}
          className="shrink-0"
        />
        <span
          className="text-[var(--color-primary)] font-bold text-[15px] tracking-tight"
          style={{ fontFamily: "var(--font-en)" }}
        >
          Seoul Subway to Summit
        </span>
      </Link>
    </header>
  );
}
