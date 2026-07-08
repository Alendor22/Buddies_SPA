export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL
    || 'https://buddies.vercel.app';
  const value = configured.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}
