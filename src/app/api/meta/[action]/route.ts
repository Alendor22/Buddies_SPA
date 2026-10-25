import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertEnabled, boundedBody, MetaError, origin } from '@/lib/meta/security';
import { beginConnection, finishConnection, ownedConnection, purpose, sendMessage, throttle } from '@/lib/meta/service';
import { createShare } from '@/lib/meta/sharing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cookie = '__Host-buddies-meta-oauth';
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
const connectionInput = z.object({ id: z.string().min(1).max(100), enabled: z.boolean() });
const sendInput = z.object({ connectionId: z.string().max(100), contactId: z.string().max(100), senderDogId: z.string().min(1).max(100), key: z.string().uuid(), text: z.string().trim().min(1).max(1000).optional(), template: z.string().regex(/^[a-z0-9_]+$/).max(128).optional(), language: z.string().regex(/^[a-z]{2}(?:_[A-Z]{2})?$/).optional() }).refine(v => Boolean(v.text) !== Boolean(v.template));
function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }); }
function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Invalid request.' }, 400);
  return json({ error: error instanceof MetaError ? error.message : 'Meta service unavailable.' }, error instanceof MetaError ? error.status : 503);
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    assertEnabled();
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);
    const { action } = await params;
    if (action === 'callback') {
      const state = z.string().min(40).max(100).parse(request.nextUrl.searchParams.get('state'));
      const code = z.string().min(1).max(4096).parse(request.nextUrl.searchParams.get('code'));
      await throttle(user.id);
      await finishConnection(user.id, state, request.cookies.get(cookie)?.value || '', code);
      const response = NextResponse.redirect(`${origin()}/dashboard/account/meta`, 303);
      response.cookies.set(cookie, '', { ...cookieOptions, maxAge: 0 });
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      return response;
    }
    if (action !== 'connections') return json({ error: 'Not found.' }, 404);
    const connections = await prisma.metaConnection.findMany({ where: { ownerId: user.id }, select: { id: true, platform: true, label: true, enabled: true, expiresAt: true, contacts: { select: { id: true, externalId: true, lastInboundAt: true, optedInAt: true }, take: 100, orderBy: { lastInboundAt: 'desc' } } } });
    const shares = await prisma.metaShare.findMany({ where: { ownerId: user.id, expiresAt: { gt: new Date() } }, select: { id: true, title: true, expiresAt: true }, take: 100 });
    return json({ connections, shares });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  try {
    assertEnabled();
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);
    if (request.headers.get('origin') !== origin()) throw new MetaError(403, 'Same-origin request required.');
    await throttle(user.id);
    const { action } = await params;
    const input = JSON.parse((await boundedBody(request, 8192)).toString('utf8'));
    if (action === 'connect') {
      const value = z.object({ purpose: z.string() }).parse(input);
      const result = await beginConnection(user.id, purpose(value.purpose));
      const response = json({ url: result.url });
      response.cookies.set(cookie, result.browser, cookieOptions);
      return response;
    }
    if (action === 'connection') {
      assertEnabled('CONNECTIONS');
      const value = connectionInput.parse(input);
      await ownedConnection(user.id, value.id);
      await prisma.metaConnection.update({ where: { id: value.id }, data: { enabled: value.enabled } });
      return json({ ok: true });
    }
    if (action === 'disconnect') {
      assertEnabled('CONNECTIONS');
      const { id } = z.object({ id: z.string().max(100) }).parse(input);
      await ownedConnection(user.id, id);
      await prisma.metaConnection.delete({ where: { id } });
      return json({ ok: true });
    }
    if (action === 'consent') {
      assertEnabled('MESSAGING');
      const value = z.object({ contactId: z.string().max(100), optedIn: z.boolean(), evidence: z.string().trim().max(500) }).parse(input);
      if (value.optedIn && value.evidence.length < 10) throw new MetaError(400, 'Record how and when the recipient agreed.');
      const result = await prisma.metaContact.updateMany({ where: { id: value.contactId, connection: { ownerId: user.id } }, data: { optedInAt: value.optedIn ? new Date() : null, consentEvidence: value.optedIn ? value.evidence : null } });
      if (!result.count) throw new MetaError(404, 'Recipient not found.');
      return json({ ok: true });
    }
    if (action === 'send') return json(await sendMessage(user.id, sendInput.parse(input)));
    if (action === 'share') {
      const value = z.object({ kind: z.enum(['profile', 'walk', 'event']), resourceId: z.string().max(100), consent: z.literal(true) }).parse(input);
      return json(await createShare(user.id, value.kind, value.resourceId), 201);
    }
    if (action === 'revoke-share') {
      const { id } = z.object({ id: z.string().uuid() }).parse(input);
      await prisma.metaShare.deleteMany({ where: { id, ownerId: user.id } });
      return json({ ok: true });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) { return failure(error); }
}
