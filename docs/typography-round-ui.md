# Typography & Round UI Refinement

**Theme:** Nunito Round UI  
**Concept:** 지하철 타고 떠나는 가벼운 산행 — light, friendly, approachable hiking from the subway exit

---

## 1. Font Strategy

### Why Nunito

Inter (our previous base font) is neutral and technical — great for productivity tools, but slightly cold for a leisure hiking app. Nunito's distinctive rounded terminals give every character a friendlier silhouette, which psychologically signals "this is manageable, not intimidating."

### Font Stack

| Variable | Stack | Purpose |
|---|---|---|
| `--font-en` | Nunito → Noto Sans KR → Noto Sans JP → system-ui | All UI text |
| `--font-ko` | Pretendard → Noto Sans KR → Nunito → system-ui | Korean sub-labels |
| `--font-num` | Nunito → system-ui | Numeric data only |

### Loading Strategy — Selective Subset Loading

CJK fonts are large (Noto Sans JP ≈ 2 MB unsubsetted). We load only what the user's language setting requires.

| Font | When loaded | How |
|---|---|---|
| **Nunito** | Always | `next/font/google` — self-hosted, zero layout shift |
| **Noto Sans KR** | Always | Static `@import` in `globals.css` — Korean appears on all trail signage regardless of UI locale |
| **Noto Sans JP** | Only when UI locale = `ja` | Dynamic `<link>` injected by `FontLoader` component |
| **Noto Sans SC** | Only when UI locale = `zh` | Dynamic `<link>` injected by `FontLoader` component |
| **Pretendard** | Always | CDN `@import` in `globals.css` |

**`FontLoader` component** (`src/components/ui/FontLoader.tsx`):
- Reads locale from `localStorage` on mount
- Listens to the `language-change` custom event (dispatched by `useLanguage`)
- Injects / removes a single `<link id="dynamic-cjk-font">` in `document.head`
- `en`, `ko`, `es` → removes any dynamic link (no extra font needed)
- `ja` → injects Noto Sans JP stylesheet
- `zh` → injects Noto Sans SC stylesheet

Google Fonts CSS API handles unicode-range subsetting automatically — only glyph blocks actually rendered on the page are downloaded.

### CJK Letter-Spacing

`.font-ko` adds `letter-spacing: 0.015em` — Korean and Japanese characters are naturally tighter than Latin; this slight expansion matches Nunito's open feel and prevents the mixed-language text from looking unbalanced.

---

## 2. Numeric Data Rule

All distance, time, and elevation stats must use the `font-num` class (or `fontFamily: "var(--font-num)"`):

```
7.1 km   →  font-num
3h 40m   →  font-num
632 m    →  font-num
11:30 AM →  font-num
```

**Psychological rationale:** Nunito's rounded digits make numbers feel less daunting. A "4h 30m" hike displayed in a friendly rounded font reads as *doable*, while the same number in a sharp geometric font can feel like a wall. This is a deliberate UX choice aligned with the app's "subway to summit" accessibility promise.

### Implementation Locations

| File | Applied to |
|---|---|
| `src/app/(shell)/page.tsx` | Duration chips, Last Safe Start time, elevation overlay |
| `src/components/ui/RouteCard.tsx` | InfoChip (distance/time), safety banner time, last safe start |

---

## 3. Round UI Theme

### Radius Tokens

| Token | Before | After | Elements |
|---|---|---|---|
| `--radius-card` | `0.75rem` (12px) | `1rem` (16px) | All cards |
| `--radius-chip` | — | `9999px` | Tag pills, info chips |
| `--radius-btn` | — | `9999px` | CTA buttons |

Existing components using `rounded-[var(--radius-card)]` automatically inherit the updated value. Components using `rounded-full` (pills/chips) already match `--radius-chip`.

### Consistency Rule

All new cards must use `rounded-[var(--radius-card)]`. All new chips/tags must use `rounded-full` or `rounded-[var(--radius-chip)]`. Never hard-code a pixel radius.

---

## 4. Header Navigation

### Context-Aware Header

The `Header` component (`src/components/layout/Header.tsx`) reads `usePathname()` and renders two modes:

| Context | Render |
|---|---|
| `/` (home) | Mountain icon + "Seoul Subway to Summit" — full brand presence |
| `/route/*` | `‹ Mountains` slim link — space-efficient, back-navigation focused |

**Rationale:** The brand logo needs prominent placement on the home screen (trust-building on first impression). Inside route views the user has already committed — screen real estate is better spent on the route name and map. The slim header reduces cognitive overhead during the hike.

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/app/globals.css` | Noto Sans KR static import (JP removed — now dynamic); updated font tokens; bumped `--radius-card`; added `--radius-chip`, `--radius-btn`; added `.font-num` and `.font-ko` letter-spacing utilities |
| `src/app/layout.tsx` | Replaced `Inter` with `Nunito` (next/font), variable `--font-nunito`; added `FontLoader` |
| `src/components/ui/FontLoader.tsx` | New — dynamic CJK font injection (JP for `ja`, SC for `zh`) |
| `src/components/ui/index.ts` | Re-exports `FontLoader` |
| `src/app/(shell)/page.tsx` | `font-num` on elevation stat, duration, Last Safe Start times |
| `src/components/ui/RouteCard.tsx` | `font-num` on InfoChip, safety banner time |
| `CLAUDE.md` | Updated Fonts section, Design Tokens radius table, Header behavior table |
