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

  const name = data.name?.en ?? "Seoul Hiking Route";
  const mountainName = data.mountain?.name?.en ?? "Seoul";
  const description =
    data.description?.en ??
    `Hike ${name} on ${mountainName} — accessible by Seoul subway. Trail details, map, and elevation profile.`;

  const distKm = data.totalDistanceM ? (data.totalDistanceM / 1000).toFixed(1) : null;
  const title = `${name} · ${mountainName} | Seoul Subway to Summit`;
  const ogImage = data.heroImages?.[0] ?? data.routePreviewImg ?? undefined;

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

/** Convert minutes → ISO 8601 duration (e.g. 220 → "PT3H40M") */
function toIsoDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}`;
}

export default async function RouteDetailPage({ params }: Props) {
  const { slug } = await params;
  const routeId = parseInt(slug, 10);
  if (isNaN(routeId)) notFound();

  const data = await getCachedRoute(routeId);
  if (!data) notFound();

  const name = data.name?.en ?? "Seoul Hiking Route";
  const mountainName = data.mountain?.name?.en ?? "Seoul";
  const description =
    data.description?.en ??
    `Hike ${name} on ${mountainName} — accessible by Seoul subway.`;
  const pageUrl = `${SITE_URL}/route/${slug}`;
  const image = data.heroImages?.[0] ?? data.routePreviewImg;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        name,
        description,
        url: pageUrl,
        ...(image ? { image } : {}),
        touristType: "Hikers",
        isAccessibleForFree: true,
        ...(data.totalDistanceM
          ? { distance: `${(data.totalDistanceM / 1000).toFixed(1)} km` }
          : {}),
        ...(data.totalDurationMin
          ? { timeRequired: toIsoDuration(data.totalDurationMin) }
          : {}),
        ...(data.mountain?.maxElevationM
          ? { maximumAttendeeCapacity: data.mountain.maxElevationM } // elevation proxy
          : {}),
        containedInPlace: {
          "@type": "LandmarksOrHistoricalBuildings",
          name: mountainName,
          address: { "@type": "PostalAddress", addressLocality: "Seoul", addressCountry: "KR" },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Routes", item: `${SITE_URL}/route` },
          { "@type": "ListItem", position: 3, name, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={null}>
        <TrailDataLoader routeId={routeId} />
      </Suspense>
    </>
  );
}
