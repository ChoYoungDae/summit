import { unstable_cache } from "next/cache";
import { fetchRouteList } from "@/lib/trails";
import { cookies } from "next/headers";
import { tDB, tUI, LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";
import { fetchSunsetMin } from "@/lib/sunset";
import { calcLatestStartFromDuration } from "@/lib/safetyEngine";
import RouteCard from "@/components/ui/RouteCard";
import { Icon } from "@iconify/react";
import {
  Trees,
  TrendingUp,
  Waves,
  Footprints,
  Eye,
  Layers,
  Wind,
  MountainSnow,
  Droplets,
  Flame,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Terrain tag id → Lucide icon ─────────────────────────────────────────────
// Label comes from DB (tag.en). Only icon mapping lives here.

const TERRAIN_TAG_ICON: Record<string, LucideIcon> = {
  rocky:            Layers,
  granite:          Layers,
  "granite-peaks":  Layers,
  steep:            TrendingUp,
  "sharp-peaks":    TrendingUp,
  forested:         Trees,
  forest:           Trees,
  "lush-forest":    Trees,
  pine:             Trees,
  ridge:            MountainSnow,
  "ridge-walk":     MountainSnow,
  view:             Eye,
  viewpoint:        Eye,
  "city-view":      Eye,
  "night-view":     Eye,
  "skyline-view":   Eye,
  "downtown-view":  Eye,
  stream:           Waves,
  water:            Droplets,
  cultural:         Footprints,
  historic:         Footprints,
  "fortress-wall":  Footprints,
  adventure:        Flame,
  adventurous:      Flame,
  accessible:       Footprints,
  "easy-boardwalk": Footprints,
  "heart-of-seoul": Footprints,
  "vast-ridges":    Layers,
  "national-park":  MountainSnow,
  "circular-loop":  Waves,
  windy:            Wind,
  gentle:           TrendingUp,
  sunny:            Sun,
  exposed:          Flame,
};

const getCachedRouteList = unstable_cache(
  async () => fetchRouteList(),
  ["route-list-v2"],
  {
    revalidate: 60 * 60, // 1 hour
    tags: ["route-list"],
  }
);

export default async function RouteListPage({
  searchParams,
}: {
  searchParams: Promise<{ mountain?: string }>;
}) {
  const cookieStore = await cookies();

  const locale = (cookieStore.get(LANGUAGE_STORAGE_KEY)?.value as SupportedLocale)
    || DEFAULT_LANGUAGE;
  
  const { mountain: mountainIdParam } = await searchParams;

  const [allGroups, sunsetMin] = await Promise.all([
    getCachedRouteList(),
    fetchSunsetMin(),
  ]);

  if (!allGroups.length) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {tUI("noRoutesAvailable", locale)}
      </div>
    );
  }

  // Filter if mountain param is present
  const groups = mountainIdParam
    ? allGroups.filter((g) => g.mountain.id === parseInt(mountainIdParam))
    : allGroups;

  if (mountainIdParam && !groups.length) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {tUI("noRoutesForMountain", locale)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      {groups.map(({ mountain, routes }) => {
        const mountainName = tDB(mountain.name, locale);
        const nameKo = mountain.name.ko;
        const terrainTags = mountain.terrainTags ?? [];

        return (
          <div key={mountain.id} id={mountain.slug} className="flex flex-col">
            {/* ── Hero section ── */}
            <div>
              {/* Photo + overlay — fixed 33 vh so hero stays compact */}
              <div className="relative h-[33vh] min-h-[180px] max-h-[260px] overflow-hidden">
                {mountain.imageUrl ? (
                  <img
                    src={mountain.imageUrl}
                    alt={mountainName}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(160deg, #2E5E4A 0%, #1E3D30 60%, #111116 100%)",
                    }}
                  />
                )}

                {/* Dark gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)",
                  }}
                />

                {/* Title + badges — bottom-left */}
                <div className="absolute bottom-4 left-4 right-4">
                  {/* Mountain name */}
                  <div className="flex items-end gap-2.5">
                    <h1
                      className="text-[2rem] font-bold leading-none tracking-tight text-white"
                      style={{ fontFamily: locale === "ko" ? "var(--font-ko)" : "var(--font-en)" }}
                    >
                      {mountainName}
                    </h1>
                    {locale !== "ko" && nameKo && (
                      <span
                        className="text-base leading-none mb-[3px] text-white/70"
                        style={{ fontFamily: "var(--font-ko)" }}
                      >
                        {nameKo}
                      </span>
                    )}
                  </div>

                  {/* Spec badges */}
                  <div className="flex items-center gap-2 mt-2.5">
                    {mountain.maxElevationM != null && (
                      <span
                        className="font-num inline-flex items-center gap-1 text-xs font-semibold text-white
                                   border border-white/50 rounded-full px-2.5 py-1 backdrop-blur-sm"
                        style={{ background: "rgba(0,0,0,0.25)" }}
                      >
                        <Icon icon="ph:mountains" width={13} height={13} />
                        {mountain.maxElevationM} m
                      </span>
                    )}
                    <span
                      className="inline-flex items-center text-xs font-medium text-white
                                 border border-white/50 rounded-full px-2.5 py-1 backdrop-blur-sm"
                      style={{ background: "rgba(0,0,0,0.25)" }}
                    >
                      {routes.length} {tUI("available", locale)} {routes.length === 1 ? tUI("routesCount", locale).replace(/s$/, "") : tUI("routesCount", locale)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terrain chips */}
              {terrainTags.length > 0 && (
                <div
                  className="flex gap-2 px-4 py-3 overflow-x-auto"
                  style={{
                    background: "var(--color-card)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    scrollbarWidth: "none",
                  }}
                >
                  {terrainTags.map((tag) => {
                    const TagIcon = TERRAIN_TAG_ICON[tag.id];
                    const tagKey = `tag_${tag.id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`;
                    return (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                                   text-xs font-medium whitespace-nowrap shrink-0"
                        style={{
                          background: "rgba(46,94,74,0.08)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {TagIcon && <TagIcon size={13} strokeWidth={2} />}
                        {tDB(tag, locale) || tUI(tagKey as any, locale)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Route cards */}
            <div className="flex flex-col gap-3 px-4 pt-3">
              {routes.map(({ route, busDurationMin, busSegmentCount, waypoints }) => {
                const latestStartMin =
                  sunsetMin !== null && route.totalDurationMin != null
                    ? calcLatestStartFromDuration(route.totalDurationMin, busDurationMin, sunsetMin)
                    : null;
                const stationWp = waypoints.find((w) => w.type === "STATION");
                let stationInfo = undefined;
                if (stationWp) {
                  let cleanEn = stationWp.name.en ?? "";
                  let cleanKo = stationWp.name.ko ?? "";
                  let inferredExit = stationWp.exitNumber;
                  // English: "Exit 4, Sadang Station" -> "Sadang Station"
                  const enMatch = cleanEn.match(/^Exit\s+(\d+),\s*(.+)$/i);
                  if (enMatch) {
                    if (!inferredExit) inferredExit = enMatch[1];
                    cleanEn = enMatch[2].trim();
                  }
                  // Korean: "사당역 4번 출구" -> "사당역"
                  cleanKo = cleanKo.replace(/\s*\d+번\s*출구\s*$/, "").trim();

                  stationInfo = {
                    name: { ...stationWp.name, en: cleanEn, ko: cleanKo },
                    lines: (stationWp.subwayLine ?? "")
                      .split(",")
                      .map((l) => {
                        const t = l.trim();
                        const n = parseInt(t, 10);
                        return !isNaN(n) && n > 0 ? n : t;
                      })
                      .filter((l) => l !== ""),
                    busNumbers: stationWp.busNumbers,
                    exitNum: inferredExit,
                  };
                }
                return (
                  <RouteCard
                    key={route.id}
                    route={route}
                    busDurationMin={busDurationMin}
                    busSegmentCount={busSegmentCount}
                    latestStartMin={latestStartMin}
                    stationInfo={stationInfo}
                    locale={locale}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
