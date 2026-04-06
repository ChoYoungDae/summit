import { fetchRouteList } from "@/lib/trails";

export const dynamic = "force-dynamic";
import { t } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";
import { fetchSunsetMin } from "@/lib/sunset";
import { calcLatestStartFromDuration } from "@/lib/safetyEngine";
import RouteCard from "@/components/ui/RouteCard";

export default async function RouteListPage() {
  const locale: SupportedLocale = "en";

  const [groups, sunsetMin] = await Promise.all([
    fetchRouteList(),
    fetchSunsetMin(),
  ]);

  if (!groups.length) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
        No routes available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 px-4 pt-3 pb-8">
      {groups.map(({ mountain, routes }) => {
        const nameEn = t(mountain.name, "en");
        const nameKo = mountain.name.ko ?? null;

        return (
          <div key={mountain.id} className="flex flex-col gap-3">
            {/* Mountain header */}
            <div>
              <div className="flex items-end gap-2.5">
                <h1
                  className="text-[1.75rem] font-bold leading-none tracking-tight"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {nameEn}
                </h1>
                {nameKo && (
                  <span
                    className="text-base leading-none mb-[3px]"
                    style={{
                      fontFamily: "var(--font-ko)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {nameKo}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                {mountain.maxElevationM != null && (
                  <span
                    className="text-[0.9375rem] font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {mountain.maxElevationM} m
                  </span>
                )}
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {routes.length} route{routes.length !== 1 ? "s" : ""} available
                </span>
              </div>
            </div>

            {/* Route cards */}
            {routes.map(({ route, elevationTrack }) => {
              const latestStartMin =
                sunsetMin !== null && route.totalDurationMin != null
                  ? calcLatestStartFromDuration(route.totalDurationMin, sunsetMin)
                  : null;
              return (
                <RouteCard
                  key={route.id}
                  route={route}
                  elevationTrack={elevationTrack}
                  latestStartMin={latestStartMin}
                  locale={locale}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
