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
| `--color-text-body` | `#6B7280` | Body / description paragraphs |
| `--color-text-muted` | `#AAABB8` | Secondary text (sub-labels, meta info, placeholders) |

## Fonts

- **English:** `Inter` (next/font/google) → CSS variable `--font-en`
- **Korean:** `Pretendard` (CDN, globals.css @import) → CSS variable `--font-ko`
- Register any new fonts the same way as a `--font-xx` CSS variable.

## Layout Shell (`src/app/layout.tsx`)

```
<html>
  <body>
    <Header />          ← fixed top, h-14 (56px), bg-primary
    <main pt-14 pb-16>  ← scrollable area
      {children}
    </main>
    <BottomNav />       ← fixed bottom, h-16 (64px)
  </body>
</html>
```

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
