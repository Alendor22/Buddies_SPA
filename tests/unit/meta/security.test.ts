import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boundedBody, decrypt, encrypt, origin, signatureValid } from '@/lib/meta/security';

describe('Meta security boundaries', () => {
  beforeEach(() => { vi.stubEnv('META_TOKEN_KEY', Buffer.alloc(32, 7).toString('base64')); vi.stubEnv('META_APP_SECRET', 'test-secret'); });
  it('encrypts with unique IVs and binds token to owner and asset', () => {
    const encrypted = encrypt('private-token', 'owner:facebook:123');
    expect(encrypted).not.toContain('private-token');
    expect(encrypt('private-token', 'owner:facebook:123')).not.toBe(encrypted);
    expect(decrypt(encrypted, 'owner:facebook:123')).toBe('private-token');
    expect(() => decrypt(encrypted, 'other-owner:facebook:123')).toThrow();
    expect(() => decrypt(encrypted, 'owner:instagram:123')).toThrow();
    const parts = encrypted.split('.'); parts[3] = Buffer.alloc(13).toString('base64url');
    expect(() => decrypt(parts.join('.'), 'owner:facebook:123')).toThrow();
  });
  it('rejects missing encryption keys', () => { vi.stubEnv('META_TOKEN_KEY', ''); expect(() => encrypt('token', 'x')).toThrow(); });
  it('validates raw-byte HMAC and rejects malformed or modified signatures', () => {
    const body = Buffer.from('{ "entry": [] }');
    const signature = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    expect(signatureValid(body, signature)).toBe(true);
    expect(signatureValid(Buffer.from('{}'), signature)).toBe(false);
    for (const value of [null, 'sha256=00', signature + 'zz', 'sha1=abc']) expect(signatureValid(body, value)).toBe(false);
  });
  it('bounds body bytes even without a content-length', async () => {
    await expect(boundedBody(new Request('https://app.test', { method: 'POST', body: '12345' }), 4)).rejects.toThrow('too large');
    expect((await boundedBody(new Request('https://app.test', { method: 'POST', body: '1234' }), 4)).toString()).toBe('1234');
  });
  it('uses only a configured HTTPS origin', () => {
    vi.stubEnv('META_APP_ORIGIN', 'https://buddies.test'); expect(origin()).toBe('https://buddies.test');
    for (const value of ['http://buddies.test', 'https://x.test/path', 'https://a:b@x.test']) { vi.stubEnv('META_APP_ORIGIN', value); expect(origin).toThrow(); }
  });
});

it('authenticates provider deauthorization requests', async () => {
  const { signedRequestUser } = await import('@/lib/meta/security');
  vi.stubEnv('META_APP_SECRET', 'test');
  const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '123', issued_at: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signature = createHmac('sha256', 'test').update(payload).digest('base64url');
  expect(signedRequestUser(`${signature}.${payload}`)).toBe('123');
  expect(() => signedRequestUser(`${signature}.${payload}x`)).toThrow();
});
