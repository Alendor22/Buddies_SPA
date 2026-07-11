type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://buddies.vercel.app').replace(/\/$/, '').replace(/^([^h])/, 'https://$1');
}

export function absoluteAppUrl(path: string) {
  return `${appUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || 'Buddies <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[auth-email] RESEND_API_KEY is not configured.', { to: payload.to, subject: payload.subject, text: payload.text });
    return { delivered: false as const, reason: 'not-configured' as const };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, html: payload.html, text: payload.text }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email delivery failed: ${response.status} ${error}`);
  }

  return { delivered: true as const };
}
