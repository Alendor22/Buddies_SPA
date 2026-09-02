// Report-only on purpose. A blocking CSP that is even slightly wrong takes the site
// down, and Mapbox (blob workers, WASM), Ably (websockets), Clerk (Frontend API,
// Turnstile iframe, avatar CDN) and Vercel Analytics each need explicit allowances.
// Ship this, read the violation reports the browser logs to the console, then flip
// the header name to 'Content-Security-Policy' once it is quiet.

// Clerk encodes its Frontend API host inside the publishable key: everything after
// the pk_test_ / pk_live_ prefix is base64 of "<host>$". Deriving it here keeps
// production (clerk.dogbuddies.net) and preview (<slug>.clerk.accounts.dev) on one
// code path instead of a hardcoded host that silently breaks the other environment.
function clerkFrontendApiOrigin() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const encoded = key.replace(/^pk_(test|live)_/, '');
  if (!encoded || encoded === key) return null;

  try {
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    // Guard against a malformed key decoding to arbitrary bytes and being spliced
    // into the header. Only a plain hostname is acceptable here.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

const clerkOrigin = clerkFrontendApiOrigin();

// Development instances also serve the account portal from accounts.*.clerk.accounts.dev,
// and a missing key at build time should not produce a policy that blocks all of Clerk.
const clerkOrigins = clerkOrigin ? [clerkOrigin] : ['https://*.clerk.accounts.dev'];

// Clerk's bot protection renders Cloudflare Turnstile in an iframe and loads its
// script from Cloudflare. Both are required for sign-up to complete when the
// "Bot sign-up protection" setting is on, which is the Clerk default.
const turnstileOrigin = 'https://challenges.cloudflare.com';

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js hydration and Mapbox both inject inline scripts; removing 'unsafe-inline'
  // requires a nonce plumbed through the document, which is a separate change.
  ["script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:", ...clerkOrigins, turnstileOrigin].join(' '),
  "style-src 'self' 'unsafe-inline'",
  // img.clerk.com serves user avatars and OAuth provider logos.
  "img-src 'self' data: blob: https://*.r2.dev https://images.unsplash.com https://api.mapbox.com https://img.clerk.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // frame-src is not inherited from child-src by modern browsers when it is absent,
  // it falls back to it -- and 'self' blob: would block the Turnstile challenge.
  `frame-src 'self' ${turnstileOrigin}`,
  "media-src 'self' blob:",
  [
    "connect-src 'self' https://api.mapbox.com https://events.mapbox.com",
    'https://*.ably.io wss://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com',
    'https://*.r2.dev',
    ...clerkOrigins,
    // Clerk telemetry is on by default; blocking it is harmless but produces
    // permanent console noise that makes real violations hard to spot.
    'https://clerk-telemetry.com'
  ].join(' '),
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
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'img.clerk.com' }
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
