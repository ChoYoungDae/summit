import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xtuqpqvjgxnclgkkxwgs.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
    ],
  },
  // Allow development access from local IP (mobile)
  allowedDevOrigins: ["192.168.0.8", "localhost:3000"],
  async headers() {
    return [
      {
        // Service worker must never be served from HTTP cache
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
