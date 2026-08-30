import type { CloudflarePolicyName } from './types';
export const cloudflarePolicies: Record<CloudflarePolicyName, { cache: 'public' | 'bypass'; rateLimit: 'low' | 'standard' | 'strict'; turnstile: boolean; zeroTrust: boolean }> = {
  'public-read': { cache: 'public', rateLimit: 'standard', turnstile: false, zeroTrust: false },
  'authenticated-api': { cache: 'bypass', rateLimit: 'standard', turnstile: false, zeroTrust: false },
  'sensitive-write': { cache: 'bypass', rateLimit: 'strict', turnstile: true, zeroTrust: false },
  'media-upload': { cache: 'bypass', rateLimit: 'strict', turnstile: true, zeroTrust: false },
  'scanner-public': { cache: 'bypass', rateLimit: 'strict', turnstile: false, zeroTrust: false },
  'admin-only': { cache: 'bypass', rateLimit: 'strict', turnstile: false, zeroTrust: true },
};
