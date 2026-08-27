import { afterEach, vi } from 'vitest';

process.env.AUTH_SECRET ||= 'test-only-auth-secret-at-least-32-characters';
process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3000';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
