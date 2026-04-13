/** Convert a display name to a URL-safe kebab-case slug. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SegmentType = "APPROACH" | "ASCENT" | "DESCENT" | "RETURN";

const DIRECTION: Record<SegmentType, "go" | "back"> = {
  APPROACH: "go",
  ASCENT:   "go",
  DESCENT:  "back",
  RETURN:   "back",
};

const TYPE_ABBR: Record<SegmentType, string> = {
  APPROACH: "apr",
  ASCENT:   "asc",
  DESCENT:  "des",
  RETURN:   "ret",
};

export function buildSegmentSlug(
  mountainSlug: string,
  segmentType: SegmentType,
  startWpSlug: string,
  endWpSlug: string,
  trailNameSlug?: string | null,
): string {
  const parts = [
    mountainSlug,
    DIRECTION[segmentType],
    TYPE_ABBR[segmentType],
    startWpSlug,
    endWpSlug,
  ];
  if (trailNameSlug) parts.push(trailNameSlug);
  return parts.join("-");
}

