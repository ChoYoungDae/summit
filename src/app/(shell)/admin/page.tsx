import WaypointManagerCard from "./WaypointManagerCard";
import SegmentUploadCard from "./SegmentUploadCard";
import RouteBuilderCard from "./RouteBuilderCard";

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="rounded-2xl bg-[#2E5E4A] p-5 text-white">
        <span className="font-semibold text-[1.125rem]" style={{ fontFamily: "var(--font-en)" }}>
          Admin — Trail Manager
        </span>
        <p className="text-white/70 text-xs mt-1 leading-relaxed">
          Build routes: add waypoints → upload GPX segments → compose routes.
        </p>
      </section>

      {/* Step 1: Waypoints */}
      <WaypointManagerCard />

      {/* Step 2: Segments (GPX upload) */}
      <SegmentUploadCard />

      {/* Step 3: Route composition */}
      <RouteBuilderCard />
    </div>
  );
}
