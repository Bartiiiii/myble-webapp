import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  // The legal pages read their markdown from `legal-source/` via fs at build
  // time. Trace those files into the standalone/serverless output so they ship.
  outputFileTracingIncludes: {
    "/legal/[doc]": ["./legal-source/**/*"],
  },
};

export default nextConfig;
