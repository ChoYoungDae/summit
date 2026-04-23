function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-full ${className ?? ""}`}
      style={{ background: "rgba(0,0,0,0.08)", ...style }}
    />
  );
}

function RouteCardSkeleton() {
  return (
    <div
      className="rounded-[var(--radius-card)] overflow-hidden px-4 pt-4 pb-3 flex flex-col gap-3"
      style={{
        background: "var(--color-card)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {/* Title */}
      <div className="flex flex-col items-center gap-1.5">
        <Pulse style={{ width: "55%", height: 18 }} />
        <Pulse style={{ width: "38%", height: 14 }} />
      </div>

      {/* Info chips */}
      <div className="flex gap-1.5 justify-center">
        <Pulse style={{ width: 72, height: 28 }} />
        <Pulse style={{ width: 64, height: 28 }} />
        <Pulse style={{ width: 56, height: 28 }} />
      </div>

      {/* Description lines */}
      <div className="flex flex-col gap-1.5">
        <Pulse style={{ width: "100%", height: 13, borderRadius: 4 }} />
        <Pulse style={{ width: "85%", height: 13, borderRadius: 4 }} />
        <Pulse style={{ width: "60%", height: 13, borderRadius: 4 }} />
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-0.5">
        <Pulse style={{ width: 100, height: 30 }} />
      </div>
    </div>
  );
}

export default function RouteLoading() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* Mountain section skeleton */}
      <div className="flex flex-col">
        {/* Hero */}
        <div
          className="relative h-[33vh] min-h-[180px] max-h-[260px] animate-pulse"
          style={{ background: "rgba(0,0,0,0.08)" }}
        >
          {/* Title + badges at bottom-left */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2.5">
            <div
              className="rounded-full animate-pulse"
              style={{ width: 160, height: 28, background: "rgba(255,255,255,0.2)" }}
            />
            <div className="flex gap-2">
              <div
                className="rounded-full animate-pulse"
                style={{ width: 60, height: 22, background: "rgba(255,255,255,0.15)" }}
              />
              <div
                className="rounded-full animate-pulse"
                style={{ width: 72, height: 22, background: "rgba(255,255,255,0.15)" }}
              />
            </div>
          </div>
        </div>

        {/* Terrain chips */}
        <div
          className="flex gap-2 px-4 py-3"
          style={{
            background: "var(--color-card)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {[56, 72, 64, 48].map((w, i) => (
            <div
              key={i}
              className="animate-pulse rounded-full shrink-0"
              style={{ width: w, height: 28, background: "rgba(46,94,74,0.08)" }}
            />
          ))}
        </div>

        {/* Route card skeletons */}
        <div className="flex flex-col gap-3 px-4 pt-3">
          <RouteCardSkeleton />
          <RouteCardSkeleton />
        </div>
      </div>
    </div>
  );
}
