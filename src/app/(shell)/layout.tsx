"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
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
      {!isAdmin && <Header />}
      <main className={`flex-1 overflow-y-auto ${!isAdmin ? "pt-14 pb-16" : "py-4"} ${
        isAdmin 
          ? "w-full px-4 md:px-8 max-w-[1200px] mx-auto" 
          : "w-full max-w-[480px] mx-auto shadow-2xl bg-[var(--bg)] min-h-screen"
      }`}>
        {children}
      </main>
      {!isAdmin && <BottomNav />}
    </>
  );
}
