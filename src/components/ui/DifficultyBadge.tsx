const LEVELS: Record<number, string> = {
  1: "Easy",
  2: "Novice",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

interface Props {
  difficulty: number;
}

export default function DifficultyBadge({ difficulty }: Props) {
  const label = LEVELS[difficulty] ?? "Unknown";
  const isHard = difficulty >= 4;

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
      style={{
        background: isHard ? "rgba(200,54,42,0.10)" : "rgba(46,94,74,0.10)",
        color:      isHard ? "#C8362A"               : "#2E5E4A",
      }}
    >
      {label}
    </span>
  );
}
