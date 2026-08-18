import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Image optimisation — whitelist all remote hostnames ───────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "iili.io",
      },
      // Backend API hosted on Render — used for any proxied/uploaded images
      {
        protocol: "https",
        hostname: "*.onrender.com",
      },
    ],
  },

  // ── Security headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent iframe embedding (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit referrer information sent to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features not needed by this app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // DNS prefetch control
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },

  reactStrictMode: true,

  // ── Standalone output for containerised/Render deployments ───────────────
  // Produces a self-contained .next/standalone directory.
  // Remove this line if deploying via Vercel (not needed there).
  // output: "standalone",
};

export default nextConfig;
