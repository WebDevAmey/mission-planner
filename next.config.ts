import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// HTTPS-only directives apply to real deployments, not `next start` on http://localhost
// (E2E and local prod checks). Vercel sets VERCEL=1; elsewhere set FORCE_HTTPS=1.
const httpsDeploy = process.env.NODE_ENV === "production" && (process.env.VERCEL === "1" || process.env.FORCE_HTTPS === "1");

// Third-party hosts the browser talks to directly (TECHNICAL_SPEC §4.2 S5).
// Nominatim and Open-Elevation stay listed until every client call goes
// through /api/geo/*; drop them then.
const MAP_HOSTS = [
  "https://tiles.openfreemap.org",
  "https://server.arcgisonline.com",
  "https://*.arcgisonline.com",
];
const GEO_HOSTS = ["https://nominatim.openstreetmap.org", "https://api.open-elevation.com"];
const FONT_CSS = "https://fonts.googleapis.com";
const FONT_FILES = "https://fonts.gstatic.com";

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; without nonces 'unsafe-inline' is required.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' ${FONT_CSS}`,
  // MapLibre decodes raster tiles and sprites into blob:/data: images.
  `img-src 'self' data: blob: ${MAP_HOSTS.join(" ")}`,
  `font-src 'self' data: ${FONT_FILES}`,
  // MapLibre fetches styles, vector tiles, glyphs and sprites with fetch().
  `connect-src 'self' ${[...MAP_HOSTS, ...GEO_HOSTS].join(" ")}${isDev ? " ws: wss:" : ""}`,
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
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
