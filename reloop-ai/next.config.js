/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "http://10.18.216.23:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
};

module.exports = nextConfig;
