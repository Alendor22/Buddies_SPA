const DOG_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export type BuddiesScanTarget = {
  path: string;
  kind: 'dog-profile' | 'public-dog-id';
};

function allowedHost(url: URL, currentOrigin: URL) {
  return url.host === currentOrigin.host || url.host === 'buddies.vercel.app';
}

function cleanSegment(value: string) {
  const decoded = decodeURIComponent(value).trim();
  return DOG_SEGMENT.test(decoded) ? decoded : null;
}

/**
 * Converts camera/native scanner payloads into a local Buddies navigation target.
 * External URLs and arbitrary paths are rejected so a QR code cannot turn the
 * scanner into an open redirect.
 */
export function resolveBuddiesScan(rawValue: string, origin: string): BuddiesScanTarget | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  let currentOrigin: URL;
  try {
    currentOrigin = new URL(origin);
  } catch {
    return null;
  }

  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || !allowedHost(url, currentOrigin)) return null;

    const dogMatch = url.pathname.match(/^\/dogs\/([^/]+)\/?$/i);
    if (dogMatch) {
      const slug = cleanSegment(dogMatch[1]);
      return slug ? { path: `/dogs/${encodeURIComponent(slug.toLowerCase())}`, kind: 'dog-profile' } : null;
    }

    const publicIdMatch = url.pathname.match(/^\/qr-dog\/([^/]+)\/?$/i);
    if (publicIdMatch) {
      const publicId = cleanSegment(publicIdMatch[1]);
      return publicId ? { path: `/qr-dog/${encodeURIComponent(publicId)}`, kind: 'public-dog-id' } : null;
    }

    return null;
  } catch {
    // Manual entry is intentionally restricted to a single dog slug/id token.
    const token = cleanSegment(raw);
    return token
      ? { path: `/dogs/${encodeURIComponent(token.toLowerCase())}`, kind: 'dog-profile' }
      : null;
  }
}
