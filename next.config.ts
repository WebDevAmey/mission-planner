import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// HTTPS-only directives apply to real deployments, not `next start` on http://localhost
// (E2E and local prod checks). Vercel sets VERCEL=1; elsewhere set FORCE_HTTPS=1.
const httpsDeploy = process.env.NODE_ENV === "production" && (process.env.VERCEL === "1" || process.env.FORCE_HTTPS === "1");

// Third-party hosts the browser talks to directly (TECHNICAL_SPEC §4.2 S5).
// Geocoding and elevation go through /api/geo/* server-side, so their hosts
// are not needed here.
const MAP_HOSTS = [
  "https://tiles.openfreemap.org",
  "https://server.arcgisonline.com",
  "https://*.arcgisonline.com",
];

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; without nonces 'unsafe-inline' is required.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Fonts are self-hosted (geist, next/font), so no third-party font hosts.
  "style-src 'self' 'unsafe-inline'",
  // MapLibre decodes raster tiles and sprites into blob:/data: images.
  `img-src 'self' data: blob: ${MAP_HOSTS.join(" ")}`,
  "font-src 'self' data:",
  // MapLibre fetches styles, vector tiles, glyphs and sprites with fetch().
  `connect-src 'self' ${MAP_HOSTS.join(" ")}${isDev ? " ws: wss:" : ""}`,
  // MapLibre spins up its tile workers from a blob: URL.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(httpsDeploy ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)",
  },
  ...(httpsDeploy
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Authenticated JSON must never be stored by a browser or shared cache;
      // no-transform keeps proxies from buffering the assistant's event stream.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, no-transform" }] },
    ];
  },
};

export default nextConfig;
