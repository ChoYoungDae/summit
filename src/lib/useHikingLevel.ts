"use client";

import { useState, useEffect, useCallback } from "react";
import {
  SKILL_LEVELS,
  DEFAULT_SKILL_INDEX,
  SKILL_STORAGE_KEY,
} from "./hikingLevel";
import type { SkillIndex } from "./hikingLevel";

const CHANGE_EVENT = "hiking-level-change";

export function useHikingLevel() {
  const [index, setIndex] = useState<SkillIndex>(DEFAULT_SKILL_INDEX);

  useEffect(() => {
    const stored = localStorage.getItem(SKILL_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 0 && parsed <= 4) setIndex(parsed as SkillIndex);
    }

    function handler(e: Event) {
      setIndex((e as CustomEvent<{ index: SkillIndex }>).detail.index);
    }
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const setLevel = useCallback((idx: SkillIndex) => {
    setIndex(idx);
    localStorage.setItem(SKILL_STORAGE_KEY, String(idx));
    window.dispatchEvent(
      new CustomEvent<{ index: SkillIndex }>(CHANGE_EVENT, { detail: { index: idx } })
    );
  }, []);

  return { index, skill: SKILL_LEVELS[index], setLevel };
}
