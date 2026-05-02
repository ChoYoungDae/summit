import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TrailDataLoader from "@/components/ui/TrailDataLoader";
import { getCachedRoute } from "@/lib/trails";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://hiking.seoulroutes.com");

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const routeId = parseInt(slug, 10);
  if (isNaN(routeId)) return {};

  const data = await getCachedRoute(routeId);
  if (!data) return {};

  const { route, mountain } = data;
  const name = route.name?.en ?? "Seoul Hiking Route";
  const mountainName = mountain?.name?.en ?? "Seoul";
  const description =
    route.description?.en ??
    `Hike ${name} on ${mountainName} — accessible by Seoul subway. Trail details, map, and elevation profile.`;

  const distKm = route.totalDistanceM ? (route.totalDistanceM / 1000).toFixed(1) : null;
  const title = `${name} · ${mountainName} | Seoul Subway to Summit`;
  const ogImage = route.heroImages?.[0] ?? route.routePreviewImg ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/route/${slug}`,
      siteName: "Seoul Subway to Summit",
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: name }] } : {}),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: { canonical: `${SITE_URL}/route/${slug}` },
    other: distKm ? { "trail:distance_km": distKm } : {},
  };
}

export default async function RouteDetailPage({ params }: Props) {
  const { slug } = await params;
  const routeId = parseInt(slug, 10);
  if (isNaN(routeId)) notFound();

  const route = await getCachedRoute(routeId);
  if (!route) notFound();

  return (
    <Suspense fallback={null}>
      <TrailDataLoader routeId={routeId} />
    </Suspense>
  );
}
