import { Suspense } from "react";
import { notFound } from "next/navigation";
import TrailDataLoader from "@/components/ui/TrailDataLoader";
import { fetchRoute } from "@/lib/trails";

export const dynamic = "force-dynamic";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const routeId = parseInt(slug, 10);
  if (isNaN(routeId)) notFound();

  const route = await fetchRoute(routeId);
  if (!route) notFound();

  return (
    <Suspense fallback={null}>
      <TrailDataLoader routeId={routeId} />
    </Suspense>
  );
}
