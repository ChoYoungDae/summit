import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ui/ServiceWorkerRegister";
import FontLoader from "@/components/ui/FontLoader";
import LocaleSync from "@/components/layout/LocaleSync";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seoul Routes",
  description: "Subway-accessible hiking guide for Seoul",
  applicationName: "S3",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2E5E4A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-950 text-[var(--fg)]">
        <LocaleSync />
        <ServiceWorkerRegister />
        <FontLoader />
        <div className="relative flex flex-col w-full max-w-[480px] mx-auto min-h-screen bg-[var(--bg)] shadow-2xl overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
