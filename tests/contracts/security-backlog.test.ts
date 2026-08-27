import { describe, it } from 'vitest';

describe('security contracts awaiting remediation', () => {
  it.todo('rejects unverified Cloudflare Access identity headers');
  it.todo('disables demo login outside an explicit development/test environment');
  it.todo('keeps registration and login GET requests non-mutating');
  it.todo('prevents register confirmation from verifying an account through query parameters');
  it.todo('requires a signed ownership-transfer token before claiming a dog');
  it.todo('requires authentication and content limits before presigning an upload');
  it.todo('fails closed when the cleanup cron secret is not configured');
  it.todo('protects database diagnostics from public access');
  it.todo('rate limits or authenticates billable directions requests');
  it.todo('applies an explicit privacy policy to precise social-map locations');
});
