"use client";

import { useRouter } from "next/navigation";

// ── Geographic projection ────────────────────────────────────────
// Real Seoul bounding box → SVG viewBox 0 0 400 300
const LON_MIN = 126.82, LON_MAX = 127.10;
const LAT_MIN = 37.38, LAT_MAX = 37.72;
const VW = 400, VH = 300;

function project(lon: number, lat: number) {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VW,
    y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VH,
  };
}

// ── Seoul Metro canonical colors (matches page.tsx SubwayBadge) ───
const METRO_COLOR: Record<number, string> = {
  2: "#00A84D",
  3: "#EF7C1C",
  4: "#3A8DDE",
  5: "#8B50A4",
};

// ── Mountain definitions ──────────────────────────────────────────
// Bukhansan  37.6586°N 126.9769°E → SVG ≈ (224, 54)   north
// Inwangsan  37.5823°N 126.9617°E → SVG ≈ (202, 122)  center
// Ansan      37.5756°N 126.9397°E → SVG ≈ (171, 127)  center-west
// Gwanaksan  37.4449°N 126.9637°E → SVG ≈ (205, 243)  south (Han 남쪽)
const MOUNTAINS = [
  {
    slug:      "bukhansan",
    nameEn:    "Bukhansan",
    nameKo:    "북한산",
    elevation: 836,
    lon:       126.9769,
    lat:       37.6586,
    labelSide: "right" as const,
    labelDx:   11,
    labelDy:   -18,
    lines:     [3],
  },
  {
    slug:      "inwangsan",
    nameEn:    "Inwangsan",
    nameKo:    "인왕산",
    elevation: 338,
    lon:       126.9617,
    lat:       37.5823,
    labelSide: "right" as const,
    labelDx:   30,   // pushed clear of mountain body at this dy level
    labelDy:   8,
    lines:     [5],
  },
  {
    slug:      "ansan",
    nameEn:    "Ansan",
    nameKo:    "안산",
    elevation: 295,
    lon:       126.9397,
    lat:       37.5756,
    labelSide: "left" as const,
    labelDx:   7,
    labelDy:   -18,
    lines:     [3],
  },
  {
    slug:      "gwanaksan",
    nameEn:    "Gwanaksan",
    nameKo:    "관악산",
    elevation: 632,
    lon:       126.9637,
    lat:       37.4449,
    labelSide: "right" as const,
    labelDx:   11,
    labelDy:   -18,
    lines:     [2, 4],
  },
] as const;


// ── Ink-painting paths per mountain ─────────────────────────────
// Each slug returns: wash (broad light fill), body (main fill),
// ridge (crisp outline), strokes (rock-texture detail lines)
function inkPaths(
  slug: string,
  px: number,
  py: number,
): { wash: string; body: string; ridge: string; strokes: string[] } {
  // Convenience: absolute point string
  const a = (dx: number, dy: number) =>
    `${+(px + dx).toFixed(1)} ${+(py + dy).toFixed(1)}`;

  switch (slug) {
    /* ── Bukhansan 836m → ~52px ── granite massif, Baegundae + Mangyeongdae */
    case "bukhansan": {
      const wash = [
        `M ${a(-46, 57)}`,
        `C ${a(-38, 44)} ${a(-28, 32)} ${a(-18, 21)}`,
        `L ${a(-10, 12)} L ${a(-4, 5)} L ${a(0, 0)}`,
        `L ${a(4, 5)} L ${a(7, 1)}`,        // Mangyeongdae secondary peak
        `L ${a(12, 9)} L ${a(18, 20)}`,
        `C ${a(27, 34)} ${a(36, 46)} ${a(46, 57)} Z`,
      ].join(" ");

      const body = [
        `M ${a(-42, 56)}`,
        `C ${a(-34, 43)} ${a(-25, 31)} ${a(-16, 20)}`,
        `L ${a(-9, 11)} L ${a(-3, 4)} L ${a(0, 0)}`,
        `L ${a(3, 4)} L ${a(6, 0)} L ${a(9, 4)}`,
        `L ${a(14, 14)} L ${a(22, 27)}`,
        `C ${a(30, 39)} ${a(37, 48)} ${a(42, 56)} Z`,
      ].join(" ");

      const ridge = [
        `M ${a(-42, 56)}`,
        `L ${a(-33, 41)} L ${a(-24, 28)} L ${a(-15, 17)} L ${a(-7, 8)}`,
        `L ${a(-2, 2)} L ${a(0, 0)}`,
        `L ${a(3, 4)} L ${a(6, 0)} L ${a(8, 3)}`, // twin peaks
        `L ${a(13, 13)} L ${a(21, 26)} L ${a(29, 39)} L ${a(36, 49)} L ${a(42, 56)}`,
      ].join(" ");

      // Vertical granite cliff strokes (인왕산처럼 하얀 바위면 표현)
      const strokes = [
        `M ${a(-4, 4)} L ${a(-7, 12)} L ${a(-5, 17)}`,
        `M ${a(-1, 2)} L ${a(-3, 10)}`,
        `M ${a(2, 3)} L ${a(3, 10)}`,
        `M ${a(6, 1)} L ${a(7, 8)}`,
        `M ${a(-14, 22)} L ${a(-17, 30)}`,
        `M ${a(13, 17)} L ${a(15, 25)}`,
        `M ${a(-23, 33)} L ${a(-24, 39)}`,
      ];

      return { wash, body, ridge, strokes };
    }

    /* ── Gwanaksan 632m → ~40px ── steep rocky south peak */
    case "gwanaksan": {
      const wash = [
        `M ${a(-34, 45)}`,
        `L ${a(-25, 33)} L ${a(-17, 22)} L ${a(-9, 12)} L ${a(-3, 4)} L ${a(0, 0)}`,
        `L ${a(4, 6)} L ${a(12, 17)} L ${a(20, 29)} L ${a(27, 39)} L ${a(34, 45)} Z`,
      ].join(" ");

      const body = [
        `M ${a(-30, 44)}`,
        `L ${a(-22, 32)} L ${a(-15, 21)} L ${a(-8, 11)} L ${a(-2, 3)} L ${a(0, 0)}`,
        `L ${a(3, 5)} L ${a(11, 16)} L ${a(18, 27)} L ${a(24, 37)} L ${a(30, 44)} Z`,
      ].join(" ");

      const ridge = [
        `M ${a(-30, 44)}`,
        `L ${a(-21, 30)} L ${a(-13, 18)} L ${a(-6, 8)} L ${a(-1, 2)} L ${a(0, 0)}`,
        `L ${a(3, 5)} L ${a(9, 14)} L ${a(15, 24)} L ${a(21, 34)} L ${a(30, 44)}`,
      ].join(" ");

      const strokes = [
        `M ${a(-3, 4)} L ${a(-5, 13)} L ${a(-4, 17)}`,
        `M ${a(1, 3)} L ${a(2, 10)}`,
        `M ${a(-11, 17)} L ${a(-13, 24)}`,
        `M ${a(10, 18)} L ${a(11, 26)}`,
      ];

      return { wash, body, ridge, strokes };
    }

    /* ── Inwangsan 338m → ~21px ── rocky cliff dome */
    case "inwangsan": {
      const wash = [
        `M ${a(-26, 24)}`,
        `C ${a(-18, 15)} ${a(-10, 7)} ${a(-2, 2)} L ${a(0, 0)} L ${a(3, 2)}`,
        `C ${a(10, 7)} ${a(18, 15)} ${a(26, 24)} Z`,
      ].join(" ");

      const body = [
        `M ${a(-24, 23)}`,
        `C ${a(-17, 15)} ${a(-10, 8)} ${a(-3, 3)} L ${a(0, 0)} L ${a(3, 3)}`,
        `C ${a(10, 8)} ${a(17, 15)} ${a(24, 23)} Z`,
      ].join(" ");

      const ridge = [
        `M ${a(-24, 23)}`,
        `L ${a(-18, 17)} L ${a(-12, 10)} L ${a(-6, 5)} L ${a(-1, 1)} L ${a(0, 0)}`,
        `L ${a(2, 2)} L ${a(7, 7)} L ${a(12, 11)} L ${a(17, 17)} L ${a(24, 23)}`,
      ].join(" ");

      // Famous sheer cliff face on right side
      const strokes = [
        `M ${a(-2, 2)} L ${a(-4, 10)} L ${a(-3, 13)}`,
        `M ${a(1, 2)} L ${a(2, 9)}`,
        `M ${a(-9, 10)} L ${a(-11, 16)}`,
      ];

      return { wash, body, ridge, strokes };
    }

    /* ── Ansan 295m → ~18px ── gentle forested hill */
    case "ansan": {
      const wash = [
        `M ${a(-23, 20)} C ${a(-14, 10)} ${a(-7, 3)} ${a(0, 0)} C ${a(7, 3)} ${a(14, 10)} ${a(23, 20)} Z`,
      ].join(" ");
      const body = wash;
      const ridge = `M ${a(-23, 20)} C ${a(-15, 12)} ${a(-7, 5)} ${a(0, 0)} C ${a(7, 5)} ${a(15, 12)} ${a(23, 20)}`;
      return { wash, body, ridge, strokes: [] };
    }

    default:
      return { wash: "", body: "", ridge: "", strokes: [] };
  }
}

// ── Pine tree silhouette (수묵화 소나무) ─────────────────────────
// Returns SVG path strings for a two-tier pine tree
function pinePaths(cx: number, cy: number, h: number): string[] {
  const w1 = h * 0.58; // bottom tier half-width
  const w2 = h * 0.37; // upper tier half-width
  const trunk = `M${+cx.toFixed(1)},${+cy.toFixed(1)} L${+cx.toFixed(1)},${+(cy - h * 0.32).toFixed(1)}`;
  const tier1 = `M${+(cx - w1).toFixed(1)},${+(cy - h * 0.08).toFixed(1)} L${+cx.toFixed(1)},${+(cy - h * 0.56).toFixed(1)} L${+(cx + w1).toFixed(1)},${+(cy - h * 0.08).toFixed(1)}`;
  const tier2 = `M${+(cx - w2).toFixed(1)},${+(cy - h * 0.42).toFixed(1)} L${+cx.toFixed(1)},${+(cy - h).toFixed(1)} L${+(cx + w2).toFixed(1)},${+(cy - h * 0.42).toFixed(1)}`;
  return [trunk, tier1, tier2];
}

// Hardcoded pine clusters — absolute SVG coords (VW=400, VH=300)
// Each entry tagged with its mountain slug for opacity filtering
const PINES: { cx: number; cy: number; h: number; slug: string }[] = [
  // Bukhansan forest (base y≈106)
  { cx: 184, cy: 102, h: 10, slug: "bukhansan" },
  { cx: 192, cy: 105, h: 9,  slug: "bukhansan" },
  { cx: 200, cy: 103, h: 10, slug: "bukhansan" },
  { cx: 209, cy: 105, h: 9,  slug: "bukhansan" },
  { cx: 218, cy: 103, h: 11, slug: "bukhansan" },
  { cx: 228, cy: 105, h: 9,  slug: "bukhansan" },
  { cx: 237, cy: 102, h: 10, slug: "bukhansan" },
  { cx: 246, cy: 105, h: 9,  slug: "bukhansan" },
  { cx: 255, cy: 103, h: 10, slug: "bukhansan" },
  // Inwangsan trees (base y≈143)
  { cx: 183, cy: 139, h: 8,  slug: "inwangsan" },
  { cx: 191, cy: 141, h: 7,  slug: "inwangsan" },
  { cx: 199, cy: 139, h: 8,  slug: "inwangsan" },
  { cx: 208, cy: 141, h: 8,  slug: "inwangsan" },
  { cx: 217, cy: 139, h: 7,  slug: "inwangsan" },
  // Ansan (heavily forested, base y≈145)
  { cx: 151, cy: 140, h: 8,  slug: "ansan" },
  { cx: 159, cy: 143, h: 9,  slug: "ansan" },
  { cx: 167, cy: 141, h: 8,  slug: "ansan" },
  { cx: 175, cy: 143, h: 8,  slug: "ansan" },
  { cx: 183, cy: 141, h: 9,  slug: "ansan" },
  { cx: 189, cy: 143, h: 7,  slug: "ansan" },
  // Gwanaksan base (base y≈283)
  { cx: 185, cy: 279, h: 8,  slug: "gwanaksan" },
  { cx: 194, cy: 282, h: 7,  slug: "gwanaksan" },
  { cx: 203, cy: 280, h: 9,  slug: "gwanaksan" },
  { cx: 212, cy: 282, h: 8,  slug: "gwanaksan" },
  { cx: 221, cy: 280, h: 8,  slug: "gwanaksan" },
  { cx: 229, cy: 282, h: 7,  slug: "gwanaksan" },
];

// ── Component ────────────────────────────────────────────────────
interface Props {
  /** When set, non-matching mountains ghost to 15% opacity */
  highlightSlugs?: string[] | null;
}

export default function SeoulMountainsIllustration({ highlightSlugs }: Props = {}) {
  const router = useRouter();

  const positions = MOUNTAINS.map((m) => ({ ...m, ...project(m.lon, m.lat) }));

  const isFiltered = !!highlightSlugs;
  const highlighted = (slug: string) => !isFiltered || highlightSlugs!.includes(slug);

  return (
    <div
      className="relative w-full rounded-[var(--radius-card)] overflow-hidden border border-[var(--color-border)]"
      style={{ height: 300, backgroundColor: "#EDE9DE" }}
    >
      {/* ── Paper grain texture ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.045,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── SVG illustration layer ── */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Sky wash — top portion */}
          <linearGradient id="skyWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#B8D0DC" stopOpacity={0.22} />
            <stop offset="55%"  stopColor="#EDE9DE" stopOpacity={0}    />
          </linearGradient>
          {/* Atmospheric mist — between Bukhansan and middle zone */}
          <linearGradient id="mistBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#EDE9DE" stopOpacity={0}    />
            <stop offset="40%"  stopColor="#D6CFC0" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#EDE9DE" stopOpacity={0}    />
          </linearGradient>
          {/* Per-mountain ink gradient: dark at peak, fades down */}
          {positions.map((m) => (
            <linearGradient
              key={`grad-${m.slug}`}
              id={`mtnGrad-${m.slug}`}
              x1="0" y1="0" x2="0" y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%"   stopColor="#243D30" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#243D30" stopOpacity={0.06} />
            </linearGradient>
          ))}
        </defs>

        {/* Sky atmosphere */}
        <rect x="0" y="0" width={VW} height={VH} fill="url(#skyWash)" />

        {/* Atmospheric mist band (Bukhansan–middle zone) */}
        <rect x="0" y="55" width={VW} height="80" fill="url(#mistBand)" />

        {/* ── Han River — curves SE→NW matching the real river ── */}
        {/*
          Real Han River at this longitude range flows NW:
            Right (x=400, 127.10°E) : upper y≈192, lower y≈204
            Center (x≈200, 126.96°E): upper y≈177, lower y≈188
            Left  (x=0,   126.82°E) : upper y≈160, lower y≈171
          Result: a gentle diagonal S-curve, not a horizontal line.
        */}
        <path
          d={`
            M 400,192 C 340,186 290,183 250,180
                       C 220,177 195,177 165,175
                       C 130,173 80,169 0,160
            L 0,172   C 80,181 130,184 165,186
                       C 195,188 220,188 250,191
                       C 290,194 340,198 400,204 Z
          `}
          fill="#8FAEBB"
          fillOpacity={0.13}
        />
        {/* Northern bank stroke */}
        <path
          d="M 400,192 C 340,186 290,183 250,180 C 220,177 195,177 165,175 C 130,173 80,169 0,160"
          fill="none"
          stroke="#5E8A9A"
          strokeWidth="0.85"
          strokeOpacity={0.32}
        />
        {/* Southern bank stroke (fainter) */}
        <path
          d="M 400,204 C 340,198 290,194 250,191 C 220,188 195,188 165,186 C 130,184 80,181 0,172"
          fill="none"
          stroke="#5E8A9A"
          strokeWidth="0.5"
          strokeOpacity={0.18}
        />

        {/* ── Topographic contour rings ── */}
        {positions.map((m) => {
          const r = (m.elevation / 836) * 28;
          return (
            <g
              key={`ctr-${m.slug}`}
              style={{ opacity: highlighted(m.slug) ? 1 : 0.15, transition: "opacity 0.3s ease" }}
            >
              <ellipse
                cx={m.x} cy={m.y + r * 0.9}
                rx={r * 1.5} ry={r * 0.45}
                fill="none" stroke="#2E5E4A"
                strokeWidth="0.4" strokeOpacity={0.10}
              />
              <ellipse
                cx={m.x} cy={m.y + r * 0.5}
                rx={r * 0.85} ry={r * 0.26}
                fill="none" stroke="#2E5E4A"
                strokeWidth="0.3" strokeOpacity={0.06}
              />
            </g>
          );
        })}

        {/* ── Mountain ink paintings ── */}
        {positions.map((m) => {
          const { wash, body, ridge, strokes } = inkPaths(m.slug, m.x, m.y);
          const mtnH = (m.elevation / 836) * 52;
          const isOn = highlighted(m.slug);
          return (
            <g
              key={`mtn-${m.slug}`}
              style={{ opacity: isOn ? 1 : 0.15, transition: "opacity 0.3s ease" }}
            >
              {/* Dancheong Red accent ring — only while a filter is active */}
              {isFiltered && isOn && (
                <ellipse
                  cx={m.x} cy={m.y + mtnH * 0.75}
                  rx={mtnH * 0.82} ry={mtnH * 0.25}
                  fill="none"
                  stroke="#C8362A"
                  strokeWidth="1.1"
                  strokeOpacity={0.35}
                  strokeDasharray="3 2.5"
                />
              )}

              {/* Layer 1: broad ink wash */}
              <path d={wash} fill="#243D30" fillOpacity={0.07} stroke="none" />

              {/* Layer 2: main body gradient */}
              <path d={body} fill={`url(#mtnGrad-${m.slug})`} stroke="none" />

              {/* Layer 3: depth shadow */}
              <path
                d={ridge}
                fill="none"
                stroke="#1A2E24"
                strokeWidth="1.2"
                strokeOpacity={0.12}
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(0.6 1.0)"
              />

              {/* Layer 4: crisp ridge outline */}
              <path
                d={ridge}
                fill="none"
                stroke="#1E3828"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.82}
              />

              {/* Layer 5: rock texture strokes */}
              {strokes.map((s, i) => (
                <path
                  key={i}
                  d={s}
                  fill="none"
                  stroke="#1E3828"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.40}
                />
              ))}
            </g>
          );
        })}

        {/* ── Pine tree clusters (수묵화 소나무) ── */}
        {PINES.map((pt, i) => (
          <g
            key={`pine-${i}`}
            style={{ opacity: highlighted(pt.slug) ? 1 : 0.15, transition: "opacity 0.3s ease" }}
          >
            {pinePaths(pt.cx, pt.cy, pt.h).map((d, j) => (
              <path
                key={j}
                d={d}
                fill="none"
                stroke="#1E3828"
                strokeWidth={j === 0 ? 0.65 : 0.80}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={j === 0 ? 0.55 : 0.45}
              />
            ))}
          </g>
        ))}

        {/* ── Han River label (positioned at left-edge river center ≈ y=166) ── */}
        <text
          x="16"
          y="167"
          fontSize="6"
          fill="#4A7A8A"
          fillOpacity={0.45}
          fontStyle="italic"
          letterSpacing="0.6"
        >
          한강  Han River
        </text>

        {/* ── North arrow ── */}
        <g transform={`translate(${VW - 22}, 22)`}>
          <circle cx="0" cy="0" r="9" fill="none" stroke="#2E5E4A" strokeWidth="0.55" strokeOpacity={0.25} />
          <path d="M 0 -6.5 L 2.2 1.5 L 0 0 L -2.2 1.5 Z" fill="#2E5E4A" fillOpacity={0.52} />
          <text x="0" y="7.5" textAnchor="middle" fontSize="5" fill="#2E5E4A" fillOpacity={0.42} fontWeight="bold">N</text>
        </g>

        {/* ── Watermark ── */}
        <text
          x="10"
          y={VH - 7}
          fontSize="7"
          fill="#2E5E4A"
          fillOpacity={0.15}
          fontFamily="serif"
          letterSpacing="2"
        >
          서울的山
        </text>
      </svg>

      {/* ── HTML overlay: tap targets + labels + subway badges ── */}
      {positions.map((m) => {
        const xPct  = (m.x / VW) * 100;
        const yPct  = (m.y / VH) * 100;
        const mtnH  = (m.elevation / 836) * 52;  // pixel height on VH=300 canvas
        const btnW  = (m.elevation / 836) * 60 + 22;
        const btnH  = mtnH + 24;
        const btnYPct = ((m.y + mtnH / 2) / VH) * 100;

        return (
          <div
            key={m.slug}
            style={{ opacity: highlighted(m.slug) ? 1 : 0.15, transition: "opacity 0.3s ease" }}
          >
            {/* Invisible tap target */}
            <button
              onClick={() => router.push(`/route#${m.slug}`)}
              className="absolute bg-transparent border-0 p-0 cursor-pointer
                         active:bg-[var(--color-primary)]/[0.07] transition-colors rounded-sm
                         focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-[var(--color-primary)]"
              style={{
                left:      `${xPct}%`,
                top:       `${btnYPct}%`,
                width:     btnW,
                height:    btnH,
                transform: "translate(-50%, -50%)",
              }}
              aria-label={`${m.nameEn} (${m.nameKo}) · ${m.elevation}m — tap to explore`}
            />

            {/* Label block: name + elevation + subway badges */}
            <div
              className="absolute pointer-events-none select-none"
              style={{
                left:      `${xPct}%`,
                top:       `${yPct}%`,
                transform: m.labelSide === "left"
                  ? `translate(calc(-100% - ${m.labelDx}px), ${m.labelDy}px)`
                  : `translate(${m.labelDx}px, ${m.labelDy}px)`,
              }}
            >
              {/* Mountain name */}
              <p
                className="text-[9px] font-bold leading-none whitespace-nowrap text-[var(--color-primary)]"
                style={{ fontFamily: "var(--font-en)" }}
              >
                {m.nameEn}{" "}
                <span
                  className="font-medium text-[8px]"
                  style={{ fontFamily: "var(--font-ko)" }}
                >
                  {m.nameKo}
                </span>
              </p>

              {/* Elevation */}
              <p
                className="text-[7.5px] leading-none mt-[2.5px] opacity-55 text-[var(--color-primary)]"
                style={{ fontFamily: "var(--font-num)" }}
              >
                {m.elevation}m
              </p>

              {/* Subway line badges */}
              <div className="flex items-center gap-[3px] mt-[3.5px]">
                <svg
                  width="8" height="8" viewBox="0 0 10 10"
                  fill="none" aria-hidden="true"
                >
                  {/* Tiny subway train icon */}
                  <rect x="1" y="2" width="8" height="6" rx="1.5"
                    fill="none" stroke="#5A6B62" strokeWidth="1.1" strokeOpacity="0.55"/>
                  <circle cx="3" cy="7" r="0.9" fill="#5A6B62" fillOpacity="0.55"/>
                  <circle cx="7" cy="7" r="0.9" fill="#5A6B62" fillOpacity="0.55"/>
                  <line x1="1" y1="4.8" x2="9" y2="4.8"
                    stroke="#5A6B62" strokeWidth="0.8" strokeOpacity="0.3"/>
                </svg>
                {m.lines.map((line) => (
                  <span
                    key={line}
                    className="inline-flex items-center justify-center rounded-full text-white font-bold leading-none"
                    style={{
                      width:           11,
                      height:          11,
                      fontSize:        "6.5px",
                      backgroundColor: METRO_COLOR[line] ?? "#888",
                      fontFamily:      "var(--font-num)",
                    }}
                  >
                    {line}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Inner shadow for depth */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[var(--radius-card)]"
        style={{ boxShadow: "inset 0 0 32px rgba(36,61,48,0.09)" }}
      />
    </div>
  );
}
