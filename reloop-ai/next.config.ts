import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "10.18.216.23",
    "10.18.216.23:3000",
  ],
};

export default nextConfig;
