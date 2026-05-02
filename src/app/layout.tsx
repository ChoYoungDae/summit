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
  title: {
    default: "Seoul Subway to Summit",
    template: "%s | Seoul Subway to Summit",
  },
  description:
    "Hike Seoul's mountains by subway — route maps, elevation profiles, and trail guides for Bukhansan, Gwanaksan, Dobongsan and more.",
  applicationName: "Seoul Subway to Summit",
  manifest: "/manifest.json",
  keywords: ["Seoul hiking", "Seoul subway hiking", "Bukhansan", "Gwanaksan", "Dobongsan", "Seoul trail map"],
  openGraph: {
    siteName: "Seoul Subway to Summit",
    type: "website",
    locale: "en_US",
  },
  robots: { index: true, follow: true },
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
        {/* Main App Container - constraints moved to sub-layouts */}
        <div className="relative flex flex-col w-full min-h-screen bg-[var(--bg)] overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
