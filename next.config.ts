import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The tutor route reads unit summaries from /content at runtime; include them in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/tutor": ["./content/units/*.md"],
  },
};

export default nextConfig;
