@AGENTS.md

# Seoul Subway to Summit — Claude Guide

## Project

Mobile web app for foreign hikers — Seoul hiking routes accessible by subway.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4 — no `tailwind.config.js`; all tokens in the `@theme` block in `src/app/globals.css`
- **Icons:** Lucide React + Iconify (`@iconify/react`) — see [Icon Policy](#icon-policy) below
- **Language:** TypeScript

## Design Tokens (`src/app/globals.css` `@theme`)

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#2E5E4A` | Namsan Pine Green — brand, CTA, active tab |
| `--color-secondary` | `#C8362A` | Dancheong Red — secondary accent |
| `--color-bg-light` | `#F7F7FA` | Light mode background |
| `--color-bg-dark` | `#111116` | Dark mode background |
| `--color-card` | `#FFFFFF` | Card surface |
| `--color-text-body` | `#4B5563` | Body / description paragraphs |
| `--color-text-muted` | `#6B7280` | Secondary text (sub-labels, meta info, placeholders) |

### Radius Tokens

| Token | Value | Usage |
|---|---|---|
| `--radius-card` | `1rem` (16px) | Cards — rounded UI theme |
| `--radius-chip` | `9999px` | Tag pills, info chips |
| `--radius-btn` | `9999px` | CTA buttons |

Bump card radius only upward. Never add a `rounded-*` class that overrides these tokens.

### Typography Scale (AllTrails-aligned)

| Element | Size | Weight | Notes |
|---|---|---|---|
| Card title | `text-base` (16px) | `font-bold` | Route / trail names |
| Body / description | `text-sm` (14px) | `font-normal` | Paragraph text |
| Info chips & labels | `text-sm` (14px) | `font-medium` | Distance, duration, difficulty |
| CTA button text | `text-sm` (14px) | `font-semibold` | "View Route" etc. |
| Safety / meta sub-labels | `text-[10px]–text-[11px]` | `font-semibold` | Uppercase tracking labels only |

Minimum readable body size is `text-sm` (14px). Do not use `text-xs` (12px) for paragraph or chip text.

## Fonts

### Font Strategy — "Nunito Round UI"

The app concept is *light subway hiking* — friendly, accessible, not intimidating. All fonts follow this principle.

| CSS Variable | Font | Loading | Usage |
|---|---|---|---|
| `--font-en` | **Nunito** → Noto Sans KR → Noto Sans JP | `next/font/google` (`--font-nunito`) | All UI text — default |
| `--font-ko` | Pretendard → Noto Sans KR → Nunito | CDN `@import` | Korean sub-labels (DualText) |
| `--font-num` | Nunito only | Same as `--font-en` | **Numeric data: distances, times, elevations** |

### Numeric Data Rule

All stats (`7.1 km`, `3h 40m`, `632 m`, time values) **must** use `font-num` class or `fontFamily: "var(--font-num)"`.

```tsx
// Tailwind utility class
<p className="font-num text-sm font-bold">3h 40m</p>

// Inline style (for dynamic/complex elements)
<span style={{ fontFamily: "var(--font-num)" }}>632m</span>
```

Nunito's rounded digits make numbers feel approachable and "doable" — a key psychological goal for the app.

### CJK Fallback

Korean/Japanese characters in `--font-en` fall through to Noto Sans KR/JP (loaded via CDN). The `.font-ko` utility adds `letter-spacing: 0.015em` to visually match Nunito's open spacing.

- Register any new fonts as `--font-xx` CSS variable + `next/font` loader.

## Layout Shell (`src/app/layout.tsx`)

```
<html>
  <body>
    <Header />          ← fixed top, h-14 (56px)
    <main pt-14 pb-16>  ← scrollable area
      {children}
    </main>
    <BottomNav />       ← fixed bottom, h-16 (64px)
  </body>
</html>
```

### Header behavior (`src/components/layout/Header.tsx`)

| Pathname | Header style |
|---|---|
| `/` (home) | Full logo: Mountain icon + "Seoul Subway to Summit" |
| `/route/*` | Slim back nav: `‹ Mountains` link (primary color, no border) |

The Header component reads `usePathname()` and switches automatically. Do not add a full logo header to any route-context page.

- When creating a new page, write content directly inside `<main>` with no extra padding.

## Bottom Tab Routes

| Tab | href | Icon |
|---|---|---|
| Route | `/route` | Map |
| Station | `/station` | Train |
| Help | `/help` | CircleHelp |
| Settings | `/settings` | Settings |

## Language Policy

**Default language is English.** Korean is shown only where it directly helps users read physical signage or place names they will encounter on the trail (e.g. trail junction signs, waypoint name markers).

### Rules

- All UI labels, navigation, and descriptive text: **English only**
- Trail waypoint names and direction callouts: show Korean alongside English, because users need to match what they see on actual signs
- Never show Korean as a standalone label without English

### `DualText` component (`src/components/ui/DualText.tsx`)

Use for any text that needs a Korean sub-label (signage contexts). The `ko` prop is optional.

```tsx
// English only (default for UI labels)
<DualText en="Bukhansan" />

// With Korean (for trail sign / place name contexts)
<DualText en="Bukhansan" ko="북한산" />

// Future language expansion — Korean always last
<DualText
  en="Dobongsan"
  ko="도봉산"
  extraLabels={[{ text: "道峰山", fontFamily: "serif" }]}
/>
```

- Do not add Korean to navigation labels, section headers, or generic UI copy.
- When adding a new language, use `extraLabels`; Korean remains the last sub-label.

## Map & Elevation Chart Design

### Map View (`src/components/ui/MapView.tsx`)

**Pitch behavior**
- Load with `pitch: 45` (3D tilt) and `fitBounds` at the same pitch so the full route is visible on open.
- On `dragstart` or `click`, ease to `pitch: 0` over 600 ms — a single interaction flattens the view.
- Do not restore 3D pitch automatically; the user controls it from that point.

**Inner shadow**
- The map container is wrapped in a `relative` div in `TrailSection`.
- An `absolute inset-0` overlay with `box-shadow: inset 0 0 16px rgba(0,0,0,0.12)` adds depth without obscuring the map.
- The overlay uses `rounded-[var(--radius-card)]` and `pointer-events-none` so it never blocks interaction.

**Visual style target:** Apple Maps detailed terrain — smooth shading, thin lines, minimal UI chrome.

### Elevation Chart (`src/components/ui/ElevationChart.tsx`)

**Minimal style**
- Stroke: `strokeWidth={1.5}` (thin line).
- Fill: SVG `<linearGradient>` — Namsan Pine Green at 18% opacity fading to 0% at the bottom. Reference as `fill="url(#elevGrad)"`.
- No `<CartesianGrid>` — axes are `hide`; nothing but the curve and gradient should be visible.

```tsx
<defs>
  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stopColor="#2E5E4A" stopOpacity={0.18} />
    <stop offset="100%" stopColor="#2E5E4A" stopOpacity={0} />
  </linearGradient>
</defs>
```

## Icon Policy

### Libraries

| Library | Package | When to use |
|---|---|---|
| Lucide React | `lucide-react` | Default for all general UI (navigation, actions, status) |
| Iconify | `@iconify/react` | When Lucide lacks a suitable icon — hiking-specific or contextual icons |

### Style Rules

- **Always use Line/Outline style.** Solid/Fill variants are forbidden.
- Target **stroke-width ≈ 2px** to match Lucide's default. For Iconify sets that don't support stroke-width (SVG path-based), choose icons whose visual weight is equivalent to Lucide at size 20–24px.

### Icon Set Mapping

```
General UI            → lucide:*
Hiking / trail        → ph:* (Phosphor, regular weight)  or  lucide:* where available
Material fallback     → mdi-light:* (only when ph:* has no suitable option)
```

Never mix fill-style icons from one set with line-style icons from another in the same UI surface.

### Waypoint Icon Catalogue

| Waypoint type | Iconify ID | Notes |
|---|---|---|
| Summit / peak | `ph:mountains` | Primary destination marker |
| Trail junction | `ph:git-fork` | Fork/split point on trail |
| Restroom | `ph:toilet` | Facility marker |
| Bus stop | `ph:bus` | Transit connection |
| Viewpoint | `ph:binoculars` | Scenic overlook |
| Water source | `ph:drop` | Spring / drinking water |
| Rest area / bench | `ph:park` | Rest spot |
| Temple / heritage | `ph:pagoda` | Cultural site |
| Parking | `ph:parking-sign` | Trailhead parking |
| Warning / caution | `ph:warning` | General hazard |

### Sunset Bar Icons

| Context | Iconify ID | Replaces |
|---|---|---|
| Sunset time indicator | `ph:sunset` | Generic clock or sun icon |
| Golden-hour alert | `ph:sun-horizon` | Generic warning |
| Daylight remaining warning | `ph:hourglass-low` | Generic warning triangle |

### Usage Example

```tsx
import { Icon } from "@iconify/react";
import { Map } from "lucide-react";

// Lucide for general UI
<Map size={20} />

// Iconify for hiking-specific
<Icon icon="ph:mountains" width={20} height={20} />
```

- Import `Icon` from `@iconify/react`; always pass explicit `width` and `height` equal to the surrounding Lucide icon size.
- Do not use Iconify's inline SVG bundle — use the `@iconify/react` component so tree-shaking works.

## Component Conventions

- `src/components/layout/` — app shell components (Header, BottomNav)
- `src/components/ui/` — reusable UI components (DualText etc.)
- Each folder has an `index.ts` re-export.
- Only add `"use client"` to components that actually need client state or hooks.
