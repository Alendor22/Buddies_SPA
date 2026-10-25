import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildMetaShareUrl, verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from '@/lib/meta/integrations';

describe('Meta integration security', () => {
  it('verifies signed webhook bytes and rejects tampering', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifyMetaWebhookSignature(body, signature, 'secret')).toBe(true);
    expect(verifyMetaWebhookSignature(Buffer.from('changed'), signature, 'secret')).toBe(false);
    expect(verifyMetaWebhookSignature(body, null, 'secret')).toBe(false);
  });
  it('checks the webhook verification token', () => {
    expect(verifyMetaWebhookChallenge('subscribe', 'token', '123', 'token')).toBe('123');
    expect(verifyMetaWebhookChallenge('subscribe', 'bad', '123', 'token')).toBeNull();
  });
  it('builds HTTPS share links', () => {
    expect(buildMetaShareUrl('facebook', 'https://dogbuddies.net/dogs/test')).toContain('facebook.com');
    expect(buildMetaShareUrl('whatsapp', 'https://dogbuddies.net/dogs/test')).toContain('wa.me');
    expect(() => buildMetaShareUrl('facebook', 'http://example.com')).toThrow();
  });
});
