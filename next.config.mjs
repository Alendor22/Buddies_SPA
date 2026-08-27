// Report-only on purpose. A blocking CSP that is even slightly wrong takes the site
// down, and Mapbox (blob workers, WASM), Ably (websockets) and Vercel Analytics each
// need explicit allowances. Ship this, read the violation reports the browser logs to
// the console, then flip the header name to 'Content-Security-Policy' once it is quiet.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydration and Mapbox both inject inline scripts; removing 'unsafe-inline'
  // requires a nonce plumbed through the document, which is a separate change.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.r2.dev https://images.unsplash.com https://api.mapbox.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://*.r2.dev",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    // Ably's browser bundle uses a nested super() call that is valid in modern
    // JavaScript but rejected by webpack's parser. The UMD bundle is
    // self-contained, so webpack can safely include it without parsing it.
    config.module.noParse = /[\\/]ably[\\/]build[\\/]ably\.js$/;
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), xr-spatial-tracking=(self), microphone=(), payment=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
        ]
      }
    ];
  }
};

export default nextConfig;
