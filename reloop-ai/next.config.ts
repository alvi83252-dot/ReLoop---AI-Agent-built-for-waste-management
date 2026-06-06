import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Disable HMR completely to avoid WebSocket SSL issues on remote access
  devIndicators: {
    buildActivityPosition: "bottom-right",
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Fix headers for security and caching
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "x-content-type-options",
            value: "nosniff",
          },
          {
            key: "cache-control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
