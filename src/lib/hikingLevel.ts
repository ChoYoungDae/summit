export const SKILL_LEVELS = [
  { label: "Novice",      multiplier: 1.5,  icon: "ph:leaf"              },
  { label: "Beginner",    multiplier: 1.25, icon: "ph:person-simple-walk" },
  { label: "Normal",      multiplier: 1.0,  icon: "ph:person-simple-hike" },
  { label: "Experienced", multiplier: 0.8,  icon: "ph:person-simple-run"  },
  { label: "Expert",      multiplier: 0.6,  icon: "ph:lightning"          },
] as const;

export type SkillIndex = 0 | 1 | 2 | 3 | 4;

export const DEFAULT_SKILL_INDEX: SkillIndex = 2;
export const SKILL_STORAGE_KEY = "hiking-level-index";
