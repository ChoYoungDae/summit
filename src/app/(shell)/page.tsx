import Link from "next/link";
import Image from "next/image";
import { TrainFront, BellRing, Timer, Sun } from "lucide-react";
import { SunsetIcon } from "@/components/ui/SunsetBarIcons";
import { DualText } from "@/components/ui/DualText";
import { fetchSunsetMin } from "@/lib/sunset";

/* ── Time formatting ──────────────────────────────────────────── */
/** 24-hour "HH:MM" */
function fmt24(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** "Xh Ym" duration label */
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** 12-hour "H:MM AM/PM" */
function fmt12(min: number): string {
  const totalH = Math.floor(min / 60);
  const h = totalH % 12 || 12;
  const m = (min % 60).toString().padStart(2, "0");
  const ampm = totalH >= 12 ? "PM" : "AM";
  return `${h}:${m} ${ampm}`;
}

/* ── Seoul Metro line colors ──────────────────────────────────── */
const LINE_COLORS: Record<number, string> = {
  1: "#0052A4",
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#3A8DDE",
  5: "#8B50A4",
  7: "#747F00",
  9: "#BDB26B",
};

function SubwayBadge({ line }: { line: number }) {
  return (
    <span
      className="inline-flex items-center justify-center w-[20px] h-[20px] rounded-full text-[11px] font-bold text-white shrink-0"
      style={{ backgroundColor: LINE_COLORS[line] ?? "#888" }}
      aria-label={`Line ${line}`}
    >
      {line}
    </span>
  );
}

/* ── Core value items ─────────────────────────────────────────── */
const CORE_VALUES = [
  {
    Icon: TrainFront,
    title: "Station-to-Trail",
    desc: "Every route starts from a subway exit — no transfers, no guesswork.",
  },
  {
    Icon: BellRing,
    title: "Safety Alerts",
    desc: "Off-route GPS alerts and photo-based junction guides.",
  },
  {
    Icon: Sun,
    title: "Safe Return Guide",
    desc: "Personalized start-time alerts to ensure you're always back before it gets dark.",
  },
];

/* ── Route card data ──────────────────────────────────────────── */
type RouteCard = {
  id: string;
  /** Display name — uses arrow format to show waypoints */
  routeName: string;
  mountain: string;
  mountainKo: string;
  elevation: number;
  /** One or more subway lines serving the trailhead station */
  subwayLines: number[];
  /** Total hiking duration in minutes — used to calculate Last Safe Start */
  durationMin: number;
  tags: string[];
  /** Optional bus chips shown alongside the route name */
  busTags?: { label: string; color: string }[];
  active: boolean;
  href: string;
  imageUrl: string | null;
};

const ROUTES: RouteCard[] = [
  {
    id: "gwanak-sadang-yeonjudae",
    routeName: "Sadang → Yeonjudae → SNU Eng.",
    mountain: "Gwanaksan",
    mountainKo: "관악산",
    elevation: 632,
    subwayLines: [2, 4], // Sadang is a Line 2 × Line 4 interchange
    durationMin: 210, // ~3 h 30 m
    tags: ["Ridgeline Walk", "Intermediate"],
    busTags: [{ label: "관악 02-1", color: "#3A7D44" }],
    active: true,
    href: "/route/1",
    imageUrl:
      "https://xtuqpqvjgxnclgkkxwgs.supabase.co/storage/v1/object/public/mountains/gwanaksan.webp",
  },
  {
    id: "bukhan-gupabal-baegundae-ui",
    routeName: "Gupabal → Bukhanseong → Baegundae → Ui-dong",
    mountain: "Bukhansan",
    mountainKo: "북한산",
    elevation: 836,
    subwayLines: [3], // Line 3 Gupabal, then bus to trailhead
    durationMin: 270, // ~4 h 30 m
    tags: ["Expert", "Granite Peaks"],
    active: false,
    href: "#",
    imageUrl: null,
  },
  {
    id: "inwang-seodaemun-circuit",
    routeName: "Seodaemun → Inwangsan Summit (Circuit)",
    mountain: "Inwangsan",
    mountainKo: "인왕산",
    elevation: 338,
    subwayLines: [5], // Line 5 Seodaemun, ~10 min walk to trailhead
    durationMin: 120, // ~2 h round trip
    tags: ["City Panorama", "Night View"],
    active: false,
    href: "#",
    imageUrl: null,
  },
  {
    id: "ansan-dongnimmun-hongdae",
    routeName: "Dongnimmun → Ansan → Hongdae",
    mountain: "Ansan",
    mountainKo: "안산",
    elevation: 295,
    subwayLines: [3], // Line 3 Dongnimmun; finish at Hongik Univ. by bus
    durationMin: 150, // ~2 h 30 m including waterfall stop
    tags: ["Family Friendly", "Accessible Trail"],
    active: false,
    href: "#",
    imageUrl: null,
  },
];

/* ── Tag pill ─────────────────────────────────────────────────── */
function TagPill({ label }: { label: string }) {
  return (
    <span className="text-[11px] font-medium px-2 py-[3px] rounded-full bg-[var(--color-primary)]/8 text-[var(--color-primary)]">
      #{label.replace(/\s+/g, "_")}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default async function HomePage() {
  const sunsetMin = await fetchSunsetMin();

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const nowMin = nowKST.getUTCHours() * 60 + nowKST.getUTCMinutes();
  const isAfter4PM = nowMin >= 16 * 60;

  const activeRoute = ROUTES.find((r) => r.active)!;
  const inactiveRoutes = ROUTES.filter((r) => !r.active);

  return (
    <div className="flex flex-col gap-8 p-4 pb-8">

      {/* ── Intro ─────────────────────────────────────────────── */}
      <section className="pt-2 flex flex-col gap-5">
        <div>
          <h1
            className="text-[1.125rem] font-bold leading-snug text-[var(--color-text-primary)]"
            style={{ fontFamily: "var(--font-en)" }}
          >
            Start Your Hike from the Subway Exit
          </h1>
          <p className="mt-2 text-[0.875rem] text-[#3A3A45] leading-relaxed">
            Every route is{" "}
            <span className="font-semibold text-[var(--color-primary)]">
              personally verified
            </span>{" "}
            for{" "}
            <span className="font-semibold text-[var(--color-primary)]">
              your safety
            </span>
            .
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {CORE_VALUES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon
                  className="w-4 h-4 text-[var(--color-primary)]"
                  strokeWidth={2}
                />
              </div>
              <div>
                <p
                  className="text-[0.875rem] font-semibold leading-snug text-[var(--color-text-primary)]"
                  style={{ fontFamily: "var(--font-en)" }}
                >
                  {title}
                </p>
                <p className="text-[0.75rem] text-[#666674] leading-snug mt-0.5">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Routes ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">

        {/* Sunset safety bar
            Background shifts to orange-toned when it's after 16:00 KST
            to signal urgency. Korean is omitted here — this is UI copy. */}
        {sunsetMin !== null && (
          <div
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-xl text-[0.75rem]",
              isAfter4PM
                ? "bg-orange-50 border border-orange-100"
                : "bg-[var(--color-warning-soft)] border border-yellow-100",
            ].join(" ")}
          >
            <SunsetIcon />
            <span
              className="font-medium"
              style={{ color: isAfter4PM ? "#92400E" : "#78600A" }}
            >
              {isAfter4PM
                ? `Descend before ${fmt24(sunsetMin)} — daylight is limited.`
                : `Safe to enjoy until ${fmt24(sunsetMin - 60)}! 😊`}
            </span>
          </div>
        )}

        <p className="mt-8 text-[0.6875rem] font-semibold tracking-widest uppercase text-[var(--color-text-muted)]">
          Featured Routes
        </p>

        {/* ── Featured active route card ──────────────────────── */}
        <div className="rounded-[var(--radius-card)] overflow-hidden bg-white border border-[var(--color-border)] shadow-sm">
          <Link
            href={activeRoute.href}
            className="block active:opacity-80 transition-opacity"
          >
            {/* Mountain photo with name overlay */}
            {activeRoute.imageUrl && (
              <div className="relative h-44 w-full">
                <Image
                  src={activeRoute.imageUrl}
                  alt={activeRoute.mountain}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  style={{ objectPosition: "82% 6%" }}
                  priority
                />
                {/* Gradient scrim for text legibility outdoors */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/75" />

                {/* Mountain name — uses manual dual-text on image (DualText
                    uses --fg / --color-text-muted which are dark-mode-aware;
                    here we need forced-white for contrast over photo) */}
                <div className="absolute bottom-3 left-3">
                  <p
                    className="text-white font-bold text-[1rem] leading-tight"
                    style={{ fontFamily: "var(--font-en)" }}
                  >
                    {activeRoute.mountain}
                  </p>
                  {/* Korean name: always visible for sign-matching — even after
                      future i18n locale switches, physical signs stay Korean */}
                  <p
                    className="text-white/65 text-[0.625rem] mt-0.5"
                    style={{ fontFamily: "var(--font-ko)" }}
                  >
                    {activeRoute.mountainKo} · {activeRoute.elevation}m
                  </p>
                </div>
              </div>
            )}

            {/* Card body */}
            <div className="p-3.5 flex flex-col gap-2.5">
              {/* Subway badge + route name */}
              <div className="flex items-start gap-2">
                <div className="flex gap-1 shrink-0">
                  {activeRoute.subwayLines.map((line) => (
                    <SubwayBadge key={line} line={line} />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p
                    className="text-[0.9375rem] font-bold leading-snug text-[var(--color-text-primary)]"
                    style={{ fontFamily: "var(--font-en)" }}
                  >
                    {activeRoute.routeName}
                  </p>
                  {activeRoute.busTags?.map((bus) => (
                    <span
                      key={bus.label}
                      className="inline-flex items-center px-1.5 py-[2px] rounded-[3px] text-[11px] font-bold text-white"
                      style={{ backgroundColor: bus.color, fontFamily: "var(--font-ko)" }}
                    >
                      {bus.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Duration + Last Safe Start */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Timer
                    className="w-[14px] h-[14px] text-[var(--color-primary)] shrink-0"
                    strokeWidth={2}
                  />
                  <p className="text-[0.75rem] font-semibold text-[var(--color-primary)]">
                    {fmtDuration(activeRoute.durationMin)}
                  </p>
                </div>
                {sunsetMin !== null && (
                  <p className="text-[0.75rem] text-[#555560]">
                    Last Safe Start{" "}
                    <span className="font-bold text-[var(--color-primary)]">
                      {fmt12(sunsetMin - activeRoute.durationMin)}
                    </span>
                  </p>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {activeRoute.tags.map((tag) => (
                  <TagPill key={tag} label={tag} />
                ))}
              </div>
            </div>
          </Link>

          {/* See all routes — separator + link */}
          <div className="border-t border-[var(--color-border)] px-3.5 py-2.5">
            <Link
              href="/route"
              className="text-[0.8125rem] font-semibold text-[var(--color-primary)] active:opacity-70 transition-opacity"
              style={{ fontFamily: "var(--font-en)" }}
            >
              See all routes for {activeRoute.mountain} →
            </Link>
          </div>
        </div>

        {/* ── Coming-soon route cards ─────────────────────────── */}
        <div className="flex flex-col gap-2">
          {inactiveRoutes.map((route) => {
            const lastSafeMin =
              sunsetMin !== null ? sunsetMin - route.durationMin : null;

            return (
              <div
                key={route.id}
                className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-3 opacity-60"
              >
                <div className="flex items-start gap-2">
                  <div className="flex gap-1">
                    {route.subwayLines.map((line) => (
                      <SubwayBadge key={line} line={line} />
                    ))}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-[0.875rem] font-semibold leading-snug text-[var(--color-text-primary)] truncate"
                        style={{ fontFamily: "var(--font-en)" }}
                      >
                        {route.routeName}
                      </p>
                      <span className="text-[0.625rem] font-semibold bg-gray-100 text-gray-400 px-2 py-[3px] rounded-full shrink-0 whitespace-nowrap">
                        Coming Soon
                      </span>
                    </div>

                    {/*
                     * DualText for mountain name — Korean (ko) is always
                     * rendered as a small sub-label regardless of future locale
                     * settings. Hikers need it to match physical trail signs.
                     */}
                    <DualText
                      en={`${route.mountain} · ${route.elevation}m`}
                      ko={route.mountainKo}
                      size="0.75rem"
                      subRatio={0.8}
                      className="mt-1"
                    />

                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Timer
                          className="w-[12px] h-[12px] text-[var(--color-text-muted)] shrink-0"
                          strokeWidth={2}
                        />
                        <p className="text-[0.6875rem] font-semibold text-[var(--color-text-muted)]">
                          {fmtDuration(route.durationMin)}
                        </p>
                      </div>
                      {lastSafeMin !== null && (
                        <p className="text-[0.6875rem] text-[var(--color-text-muted)]">
                          Last Safe Start: {fmt12(lastSafeMin)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {route.tags.map((tag) => (
                        <TagPill key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* See all routes — disabled for coming-soon mountains */}
                <div className="border-t border-[var(--color-border)] px-3 py-2.5 mt-3 -mx-3 -mb-3">
                  <span
                    className="text-[0.8125rem] font-semibold text-[var(--color-text-muted)] cursor-not-allowed"
                    style={{ fontFamily: "var(--font-en)" }}
                    aria-disabled="true"
                  >
                    See all routes for {route.mountain} →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
