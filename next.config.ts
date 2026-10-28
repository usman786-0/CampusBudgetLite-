import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
// Wird beim Build ausgewertet: nur echte https-Deployments erzwingen das Upgrade
// (lokal per Docker unter http://localhost würden sonst alle Assets fehlschlagen).
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");
const analyticsHost = process.env.NEXT_PUBLIC_PLAUSIBLE_HOST ?? "";

// Next.js benötigt Inline-Skripte für die Hydration. Eine Nonce-basierte CSP würde jede
// Seite dynamisch rendern; daher 'unsafe-inline' für Skripte, alle übrigen Quellen strikt.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${analyticsHost ? ` ${analyticsHost}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${analyticsHost ? ` ${analyticsHost}` : ""}${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Das schwebende Dev-Symbol (unten links) überdeckt auf dem Handy Bottom-Navigation und Cookie-Banner
  devIndicators: false,
  serverExternalPackages: ["@node-rs/argon2"],
  // Der Prisma-Query-Compiler (WASM) wird zur Laufzeit per fs gelesen und vom Tracing nicht erkannt
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/.prisma/client/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
