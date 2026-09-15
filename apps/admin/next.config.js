/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Let Next.js/webpack traverse the monorepo root so it can resolve
    // @taskswift/* workspace packages that live outside apps/admin.
    outputFileTracingRoot: path.join(__dirname, "../.."),
    serverComponentsExternalPackages: ["pg"],
  },
};

module.exports = nextConfig;
