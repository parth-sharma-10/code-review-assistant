import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // The browser only ever talks to this origin. /api/* is proxied to NestJS, so the auth
  // cookie is first-party, SameSite works as intended, and no CORS preflights are needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
  experimental: {
    // Default rewrite-proxy timeout is 30s; a review on a local model can take minutes.
    // Kept above the backend's AI_TIMEOUT_MS (180s) so the backend reports the timeout.
    proxyTimeout: 200_000,
    // Because proxy.ts exists, Next buffers request bodies and silently truncates them at 10MB
    // by default, which makes a large ZIP upload hang. Allow the backend's 20MB limit plus
    // multipart overhead; proxy.ts rejects anything larger before it is buffered.
    proxyClientMaxBodySize: "21mb",
  },
};

export default nextConfig;
