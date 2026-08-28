type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailDeliveryResult =
  | { delivered: true; provider: 'resend' }
  | { delivered: false; reason: 'not-configured' | 'provider-error'; status?: number };

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://buddies.vercel.app').replace(/\/$/, '').replace(/^([^h])/, 'https://$1');
}

export function absoluteAppUrl(path: string) {
  return `${appUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM || 'Buddies <onboarding@resend.dev>';

  if (!apiKey) {
    console.error('[auth-email] transactional email is not configured', {
      event: 'auth_email_not_configured',
      subject: payload.subject,
    });
    return { delivered: false, reason: 'not-configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, html: payload.html, text: payload.text }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[auth-email] provider rejected transactional email', {
        event: 'auth_email_provider_error',
        status: response.status,
        subject: payload.subject,
        error,
      });
      return { delivered: false, reason: 'provider-error', status: response.status };
    }

    return { delivered: true, provider: 'resend' };
  } catch (error) {
    console.error('[auth-email] provider request failed', {
      event: 'auth_email_provider_error',
      subject: payload.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false, reason: 'provider-error' };
  }
}
