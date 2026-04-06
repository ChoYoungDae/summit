"use client";

import { Icon } from "@iconify/react";
import sunHorizon from "@iconify-icons/ph/sun-horizon-light";
import warning from "@iconify-icons/ph/warning-light";

export function SunsetIcon() {
  return <Icon icon={sunHorizon} width={14} height={14} className="shrink-0" />;
}

export function DescendWarningIcon({ isUrgent }: { isUrgent: boolean }) {
  return (
    <Icon
      icon={warning}
      width={14}
      height={14}
      className="shrink-0"
      style={{ color: isUrgent ? "#f97316" : "inherit" }}
    />
  );
}
