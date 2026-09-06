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
  // This app carries super-admin-only capabilities (platform governance, purge,
  // security settings) — headers here are intentionally stricter than the
  // public marketing/student frontend's.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent iframe embedding entirely (clickjacking) — this app never
          // needs to be embedded, unlike the public site which allows none anyway.
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Never leak this app's URLs (which may contain admin context) to other origins
          { key: "Referrer-Policy", value: "no-referrer" },
          // Disable browser features not needed by this app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Discourage search engines from indexing an internal admin tool
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
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
