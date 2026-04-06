import { Icon } from "@iconify/react";
import { Train, Shield } from "lucide-react";

// ── Shared card wrapper ────────────────────────────────────────────────────

function Section({
  icon,
  iconId,
  title,
  accent = false,
  children,
}: {
  icon?: React.ReactNode;
  iconId?: string;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 flex flex-col gap-3"
      style={{ background: "var(--color-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: 36,
            height: 36,
            background: accent ? "rgba(200,54,42,0.10)" : "rgba(46,94,74,0.09)",
          }}
        >
          {iconId ? (
            <Icon
              icon={iconId}
              width={18}
              height={18}
              style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
            />
          ) : (
            icon
          )}
        </div>
        <h2
          className="font-bold text-sm"
          style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Item({
  iconId,
  icon,
  label,
  body,
  accent = false,
}: {
  iconId?: string;
  icon?: React.ReactNode;
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
        style={{
          width: 28,
          height: 28,
          background: accent ? "rgba(200,54,42,0.08)" : "rgba(46,94,74,0.07)",
        }}
      >
        {iconId ? (
          <Icon
            icon={iconId}
            width={14}
            height={14}
            style={{ color: accent ? "#C8362A" : "var(--color-primary)" }}
          />
        ) : (
          icon
        )}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-body)" }}>
          {label}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function InfoPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">

      {/* Hero */}
      <div
        className="rounded-2xl px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(46,94,74,0.07)" }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 44, height: 44, background: "rgba(46,94,74,0.12)" }}
        >
          <Icon icon="ph:mountains" width={22} height={22} style={{ color: "var(--color-primary)" }} />
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: "var(--color-primary)" }}>
            Essential Hiking Guide for Seoul
          </p>
          <p className="text-xs leading-snug" style={{ color: "var(--color-text-body)" }}>
            Everything foreign hikers need to know before hitting the trail.
          </p>
        </div>
      </div>

      {/* 1. Tourism Center */}
      <Section iconId="ph:map-trifold" title="Seoul Hiking Tourism Center">
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-body)" }}>
          Need gear? Start your journey here. These centers provide everything international hikers
          need for a perfect day on the mountain.
        </p>
        <a
          href="https://seoulhiking.or.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start"
          style={{ color: "var(--color-primary)" }}
        >
          <Icon icon="ph:arrow-square-out" width={13} height={13} />
          <span className="text-xs font-medium underline underline-offset-2">seoulhiking.or.kr</span>
        </a>

        {/* Center locations */}
        <div className="flex flex-col gap-2">
          {[
            {
              name: "Bukhansan",
              subway: "Bukhansan Ui Stn · Exit 2 (Ui-Sinseol Line)",
              hours: "09:00 – 18:00",
              closed: "Closed Mondays",
            },
            {
              name: "Bugaksan",
              subway: "Anguk Stn · Exit 2 (Line 3)",
              hours: "09:00 – 18:00",
              closed: "Closed Tuesdays",
            },
            {
              name: "Gwanaksan",
              subway: "Gwanaksan Stn · B1 (Sinlim Line)",
              hours: "09:00 – 18:00",
              closed: "Closed Wednesdays",
            },
          ].map((c) => (
            <div
              key={c.name}
              className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
              style={{ background: "rgba(46,94,74,0.06)" }}
            >
              <Icon
                icon="ph:map-pin"
                width={14}
                height={14}
                style={{ color: "var(--color-primary)", marginTop: 2, flexShrink: 0 }}
              />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold" style={{ color: "var(--color-text-body)" }}>
                  {c.name}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {c.subway}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {c.hours} · {c.closed}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Item
            iconId="ph:backpack"
            label="Gear Rental"
            body="High-quality hiking boots, clothes, and poles at affordable rates."
          />
          <Item
            iconId="ph:lock-key"
            label="Facilities"
            body="Luggage storage (lockers), changing rooms, and shower facilities."
          />
          <Item
            iconId="ph:book-open"
            label="Information"
            body="Multilingual hiking maps and expert trail recommendations."
          />
        </div>
      </Section>

      {/* 2. Why Seoul */}
      <Section iconId="ph:mountains" title="Why Seoul is a Hiker's Paradise">
        <div className="flex flex-col gap-3">
          <Item
            icon={<Train size={14} style={{ color: "var(--color-primary)" }} />}
            label="The 30-Minute Rule"
            body="Unlike London, Paris, or NYC, Seoul offers 800 m peaks accessible within 30 minutes via subway — a rare megacity where the National Park begins where the city ends."
          />
          <Item
            iconId="ph:stairs"
            label="Well-Managed Nature"
            body="Forget 'wilderness' fear. Trails are meticulously maintained with stairs, mats, and safety rails — secure for all skill levels."
          />
          <Item
            iconId="ph:cell-signal-full"
            label="Hyper-Connected Safety"
            body="Full 5G/LTE coverage even at the summit. Share your GPS in an emergency instantly. Trails end at subway stations surrounded by K-food spots."
          />
          <Item
            iconId="ph:paw-print"
            label="Low Wildlife Risk"
            body="No bears or mountain lions. Wild boars exist, but staying on designated well-traveled paths makes your hike exceptionally safe."
          />
        </div>
      </Section>

      {/* 3. Safety & Rules */}
      <Section
        icon={<Shield size={18} style={{ color: "#C8362A" }} />}
        title="Important Safety & Rules"
        accent
      >
        <div className="flex flex-col gap-3">
          <Item
            iconId="ph:boot"
            label="Gear Up for Granite"
            body="Most Seoul mountains (Bukhansan, Gwanaksan) are granite-based. Standard sneakers are slippery on these rocks — hiking boots with good grip are mandatory. Rent at the Tourism Center if needed."
            accent
          />
          <Item
            iconId="ph:prohibit"
            label="No Alcohol"
            body="Drinking on the mountain is strictly prohibited by law and is dangerous on rocky terrain."
            accent
          />
          <Item
            iconId="ph:paw-print"
            label="Wildlife Etiquette"
            body="You may encounter friendly mountain cats or dogs. They are not a threat, but please do not feed them to preserve their natural instincts."
            accent
          />
        </div>
      </Section>

      {/* 4. Zero-Waste */}
      <Section iconId="ph:leaf" title='The "Zero-Waste" Policy — BYOB'>
        <div className="flex flex-col gap-3">
          <Item
            iconId="ph:trash"
            label="No Trash Cans"
            body='International visitors are often surprised to find no trash cans on Korean trails.'
          />
          <Item
            iconId="ph:bag"
            label="Bring Your Own Bag (BYOB)"
            body='We follow the "Leave No Trace" principle. Everything you bring up, you must carry down.'
          />
        </div>
      </Section>

    </div>
  );
}
