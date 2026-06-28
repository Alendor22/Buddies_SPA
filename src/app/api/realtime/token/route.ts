import { NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET() {
  if (!process.env.ABLY_API_KEY) return NextResponse.json({ error: 'ABLY_API_KEY is not configured' }, { status: 503 });
  const client = new Ably.Rest(process.env.ABLY_API_KEY);
  const tokenRequest = await client.auth.createTokenRequest({ clientId: `guest-${crypto.randomUUID()}` });
  return NextResponse.json(tokenRequest);
}
