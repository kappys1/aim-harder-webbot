import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Exclude server-only packages from client bundle to reduce bundle size
  experimental: {
    serverComponentsExternalPackages: ['cheerio'],
  },
};

export default withPWA(nextConfig);
