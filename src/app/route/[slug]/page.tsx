import { Suspense } from "react";
import { notFound } from "next/navigation";
import TrailDataLoader from "@/components/ui/TrailDataLoader";
import { getCachedRoute } from "@/lib/trails";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
