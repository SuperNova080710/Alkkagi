import type { NextConfig } from "next";

// Protected or account-specific pages should never be included in Google Search.
// In a Vercel preview, the entire deployment is explicitly non-indexable.
const privatePaths = [
  "/login",
  "/signup",
  "/lobby/:path*",
  "/ranked/:path*",
  "/rooms/:path*",
  "/profile/:path*",
  "/players/:path*",
  "/friends/:path*",
  "/api/:path*",
  "/auth/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const paths = process.env.VERCEL_ENV === "production"
      ? privatePaths
      : ["/:path*"];

    return paths.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
