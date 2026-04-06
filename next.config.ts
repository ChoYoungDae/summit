import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xtuqpqvjgxnclgkkxwgs.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Allow development access from local IP (mobile)
  allowedDevOrigins: ["192.168.0.8", "localhost:3000"],
  async headers() {
    const headers = [
      {
        // Service worker must never be served from HTTP cache so browsers
        // always get the latest version on reload.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];

    if (process.env.NODE_ENV === "development") {
      headers.push({
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      });
    }

    return headers;
  },
};

export default nextConfig;
