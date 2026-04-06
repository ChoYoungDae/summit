export default function TrailSectionSkeleton() {
  return (
    <>
      {/* Map skeleton */}
      <div
        className="w-full animate-pulse bg-[var(--color-bg-light)]"
        style={{ height: "420px" }}
      />

      <div className="border-t border-[var(--color-border)]" />

      {/* Elevation chart skeleton */}
      <div className="bg-card px-2 pt-3 pb-1">
        <div className="h-3 w-32 rounded bg-[var(--color-bg-light)] animate-pulse mb-2" />
        <div className="h-[110px] rounded bg-[var(--color-bg-light)] animate-pulse" />
      </div>
    </>
  );
}
