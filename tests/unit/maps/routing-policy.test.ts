import { describe, expect, it } from 'vitest';
import { shouldFallbackToDirectMapbox } from '@/lib/maps/routingPolicy';

describe('shouldFallbackToDirectMapbox', () => {
  it('does not bypass authentication or rate-limit responses', () => {
    expect(shouldFallbackToDirectMapbox(401)).toBe(false);
    expect(shouldFallbackToDirectMapbox(429)).toBe(false);
  });

  it('preserves fallback for other server route failures', () => {
    expect(shouldFallbackToDirectMapbox(503)).toBe(true);
    expect(shouldFallbackToDirectMapbox(500)).toBe(true);
  });
});
