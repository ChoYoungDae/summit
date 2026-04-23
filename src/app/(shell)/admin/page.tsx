import Link from "next/link";
import WaypointManagerCard from "./WaypointManagerCard";
import SegmentUploadCard from "./SegmentUploadCard";
import RouteBuilderCard from "./RouteBuilderCard";
import PhotoUploadCard from "./PhotoUploadCard";

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

      <Link
        href="/admin/new-route"
        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-primary text-primary py-3 text-sm font-semibold hover:bg-primary/5 transition-colors"
      >
        + Create New Route (Guided Wizard)
      </Link>

      {/* Step 1: Waypoints */}
      <WaypointManagerCard />

      {/* Step 2: Segments (GPX upload) */}
      <SegmentUploadCard />

      {/* Step 3: Route composition */}
      <RouteBuilderCard />

      {/* Step 4: Photo upload */}
      <PhotoUploadCard />
    </div>
  );
}
