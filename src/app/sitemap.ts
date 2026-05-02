import type { MetadataRoute } from "next";
import { fetchRouteList } from "@/lib/trails";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://seoulsubwaytosummit.com");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const groups = await fetchRouteList();

  const routeEntries: MetadataRoute.Sitemap = groups.flatMap((g) =>
    g.routes.map((r) => ({
      url: `${SITE_URL}/route/${r.route.id}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  );

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/route`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...routeEntries,
  ];
}
