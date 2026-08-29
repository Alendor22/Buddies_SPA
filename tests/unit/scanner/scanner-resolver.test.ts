import { describe, expect, it } from 'vitest';
import { resolveBuddiesScan } from '@/lib/scanner';

const ORIGIN = 'https://buddies.vercel.app';

describe('resolveBuddiesScan', () => {
  it('accepts a Buddies dog profile QR URL', () => {
    expect(resolveBuddiesScan('https://buddies.vercel.app/dogs/Scout-01', ORIGIN)).toEqual({
      path: '/dogs/scout-01',
      kind: 'dog-profile'
    });
  });

  it('accepts a Buddies public id QR URL', () => {
    expect(resolveBuddiesScan('https://buddies.vercel.app/qr-dog/DOG_123', ORIGIN)).toEqual({
      path: '/qr-dog/DOG_123',
      kind: 'public-dog-id'
    });
  });

  it('accepts a single manual dog slug', () => {
    expect(resolveBuddiesScan('Scout-01', ORIGIN)).toEqual({
      path: '/dogs/scout-01',
      kind: 'dog-profile'
    });
  });

  it('rejects external QR destinations', () => {
    expect(resolveBuddiesScan('https://example.com/dogs/scout', ORIGIN)).toBeNull();
  });

  it('rejects non-profile Buddies URLs', () => {
    expect(resolveBuddiesScan('https://buddies.vercel.app/dashboard', ORIGIN)).toBeNull();
  });

  it('rejects path injection in manual input', () => {
    expect(resolveBuddiesScan('../dashboard', ORIGIN)).toBeNull();
  });

  it('rejects malformed percent encoding without throwing', () => {
    expect(resolveBuddiesScan('https://buddies.vercel.app/dogs/%E0%A4%A', ORIGIN)).toBeNull();
    expect(resolveBuddiesScan('%E0%A4%A', ORIGIN)).toBeNull();
  });
});
