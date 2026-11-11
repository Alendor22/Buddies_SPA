import { S3Client } from '@aws-sdk/client-s3';

function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

function accountId() {
  const value = env('R2_ACCOUNT_ID');
  if (!value) return undefined;
  return value
    .replace(/^https?:\/\//i, '')
    .split('.')[0]
    .replace(/\/$/, '');
}

const r2AccountId = accountId();

export const r2 = new S3Client({
  region: 'auto',
  endpoint: r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined,
  credentials: env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') ? {
    accessKeyId: env('R2_ACCESS_KEY_ID')!,
    secretAccessKey: env('R2_SECRET_ACCESS_KEY')!
  } : undefined
});
