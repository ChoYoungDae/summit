"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  return (
    <>
      <main className={`flex-1 overflow-y-auto ${!isAdmin ? "pb-16" : "py-4"} ${
        isAdmin
          ? "w-full px-4 md:px-12 lg:px-20 max-w-[2400px] mx-auto"
          : "w-full max-w-[480px] mx-auto shadow-2xl bg-[var(--bg)] min-h-screen"
      }`}>
        {children}
      </main>
      {!isAdmin && <BottomNav />}
    </>
  );
}
