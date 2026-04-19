/**
 * Internationalization utility for JSONB-backed multilingual text fields.
 *
 * DB columns (name, description, direction_guide) are stored as JSONB objects
 * supporting 5 locales: en, ko, zh, ja, es.
 *
 *   { "en": "...", "ko": "...", "zh": "...", "ja": "...", "es": "..." }
 *
 * Use `t()` to resolve the right string for the current locale,
 * with automatic fallback to English when the locale key is absent.
 */

/** The 5 supported UI locales. */
export type SupportedLocale = "en" | "ko" | "zh" | "ja" | "es";

/**
 * A multilingual text object stored as JSONB in the database.
 * `en` is required; all other locales are optional so partial data is valid.
 * UI components and type definitions must accept all 5 keys.
 */
export type LocalizedText = {
  en: string;
  ko?: string;
  zh?: string;
  ja?: string;
  es?: string;
};

/**
 * Returns the text for `locale` from a LocalizedText object.
 * Falls back to English ("en") if the requested locale is missing or empty.
 * Returns "" if the object itself is null / undefined.
 *
 * @example
 *   t({ en: "Summit", ko: "정상" }, "ko")  // → "정상"
 *   t({ en: "Summit", ko: "정상" }, "ja")  // → "Summit"  (fallback)
 *   t(undefined, "en")                     // → ""
 */
export function t(
  text: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!text) return "";
  return (text as Record<string, string | undefined>)[locale] || text.en || "";
}

/** ── UI String Translations ────────────────────────────────────────────────── */

export const UI_STRINGS = {
  en: {
    settings: "Settings",
    language: "Language",
    hikingLevel: "Hiking Level",
    navigation: "Navigation",
    about: "About",
    offRouteAlert: "Off-route Alert Distance",
    helpSafety: "Help & Safety Info",
    version: "Version",
    startHiking: "Start Hiking",
    endHike: "End Hike",
    ascending: "Ascending",
    descending: "Descending",
    toPeak: "to peak",
    toTrailhead: "to trailhead",
    myHikingLevel: "My Hiking Level",
    lastSafeStart: "Last safe start",
    viewRoute: "View Route",
    comingSoon: "Coming soon",
    homeTitle: "Start Your Hike in Seoul from the Subway Exit.",
    homeSubtitle: "Every route is personally verified for your safety.",
    findPerfectTrail: "Find your perfect Seoul trail",
    discoverYourPeak: "Discover Your Peak",
    tapMountain: "Tap a mountain to explore routes",
    valueStationTitle: "Station-to-Trail",
    valueStationDesc: "Every route starts from a subway exit — no transfers, no guesswork.",
    valueGPSAlertsTitle: "GPS Alerts",
    valueGPSAlertsDesc: "Real-time off-route alerts to keep you on the right path.",
    valueSafetyReturnTitle: "Safety Return",
    valueSafetyReturnDesc: "Personalized start-time alerts to get you back before dark.",
    valueJunctionGuideTitle: "Junction Guide",
    valueJunctionGuideDesc: "Photo-based guides for every tricky intersection.",
    personalNote: "Hi! I'm personally mapping out the Seoul trails I’ve loved and walked for decades. I’m currently uploading my favorite routes, vivid photos, and hidden tips one by one. Please visit often to see my journey unfold and find your next adventure!",
    chipChallenge: "The Challenge",
    chipCityViews: "City Views",
    chipNatureWalk: "Nature Walk",
    elevation: "Elevation",
    routesCount: "Routes",
    level: "Level",
    meters: "m",
  },
  ko: {
    settings: "설정",
    language: "언어 설정",
    hikingLevel: "등산 숙련도",
    navigation: "내비게이션 설정",
    about: "앱 정보",
    offRouteAlert: "경로 이탈 알림 거리",
    helpSafety: "도움말 및 안전 정보",
    version: "버전",
    startHiking: "등산 시작",
    endHike: "등산 종료",
    ascending: "상행 중",
    descending: "하행 중",
    toPeak: "정상까지",
    toTrailhead: "입구까지",
    myHikingLevel: "나의 등산 수준",
    lastSafeStart: "권장 산행 시작 시간",
    viewRoute: "상세 경로 보기",
    comingSoon: "준비 중",
    homeTitle: "지하철에서 시작하는 서울 산행",
    homeSubtitle: "안전한 산행을 위해 모든 경로를 직접 검증했습니다.",
    findPerfectTrail: "나에게 맞는 서울 산길 찾기",
    discoverYourPeak: "산행지 찾아보기",
    tapMountain: "지형도의 산을 눌러 경로를 확인해 보세요",
    valueStationTitle: "지하철역에서 입구까지",
    valueStationDesc: "모든 경로는 지하철역 출구에서 시작됩니다. 헤맬 걱정 없이 바로 떠나세요.",
    valueGPSAlertsTitle: "실시간 GPS 알림",
    valueGPSAlertsDesc: "경로 이탈 시 즉시 알림을 보내 안전한 산행을 도와드립니다.",
    valueSafetyReturnTitle: "안전 귀가 가이드",
    valueSafetyReturnDesc: "해가 지기 전 하산할 수 있도록 맞춤형 권장 시작 시간을 알려드립니다.",
    valueJunctionGuideTitle: "갈림길 가이드",
    valueJunctionGuideDesc: "헷갈리는 갈림길마다 사진 기반의 안내를 제공합니다.",
    personalNote: "안녕하세요! 수십 년간 직접 걷고 좋아했던 서울의 산길들을 하나씩 기록하고 있습니다. 저의 경험과 팁이 담긴 경로들이 여러분의 새로운 모험에 도움이 되기를 바랍니다. 자주 방문해 주세요!",
    chipChallenge: "도전적인 경로",
    chipCityViews: "탁 트인 조망",
    chipNatureWalk: "자연 속 산책",
    elevation: "해발고도",
    routesCount: "보유 경로",
    level: "난이도",
    meters: "m",
  },
} as const;

export function tUI(key: keyof typeof UI_STRINGS.en, locale: string): string {
  const dict = (UI_STRINGS as any)[locale] || UI_STRINGS.en;
  return dict[key] || UI_STRINGS.en[key];
}
