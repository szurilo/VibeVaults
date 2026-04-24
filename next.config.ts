import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://eu.i.posthog.com/decide",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  // Stable Server Action encryption is configured via the
  // NEXT_SERVER_ACTIONS_ENCRYPTION_KEY env var (read automatically by Next at
  // build time). Generate with: openssl rand -base64 32 — set it in Vercel
  // Project Settings → Environment Variables for Production.
  // Vercel Skew Protection (separately enabled in Vercel Project Settings →
  // Advanced) routes old clients back to their original deployment so old
  // Server Action IDs still resolve — prevents "Failed to find Server Action"
  // 404s during the deploy-overlap window.
};

export default nextConfig;
