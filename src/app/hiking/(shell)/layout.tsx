import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto pt-14 pb-16">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
