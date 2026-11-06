import { prisma } from '@/lib/db';
import { boundedBody, hash, MetaError, opaque, origin, signedRequestUser } from '@/lib/meta/security';

export const runtime = 'nodejs';
// Privacy cleanup remains available even when feature flags are turned off.
// Configure this URL for both Meta deauthorization and data-deletion callbacks.
export async function POST(request: Request) {
  try {
    const form = new URLSearchParams((await boundedBody(request, 8192)).toString('utf8'));
    const userId = signedRequestUser(form.get('signed_request') || '');
    const ownerIds = await prisma.metaConnection.findMany({ where: { providerUserId: userId }, select: { ownerId: true } });
    await prisma.$transaction([
      prisma.metaConnection.deleteMany({ where: { providerUserId: userId } }),
      prisma.metaOAuthState.deleteMany({ where: { ownerId: { in: ownerIds.map(row => row.ownerId) } } })
    ]);
    const confirmation = hash(opaque());
    return Response.json({ url: `${origin()}/meta/deletion?confirmation=${confirmation}`, confirmation_code: confirmation }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: 'Deletion request could not be processed.' }, { status: error instanceof MetaError ? error.status : 503 });
  }
}
