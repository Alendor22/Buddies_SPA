import Ably from 'ably';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { realtimeChannels } from '@/lib/realtimeChannels';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ABLY_API_KEY is not configured.' }, { status: 503 });

  const [walks, dogs] = await Promise.all([
    prisma.walk.findMany({
      where: {
        OR: [
          { requesterId: user.id },
          { walkerId: user.id },
          { dog: { ownerId: user.id } },
          { invitations: { some: { senderDog: { ownerId: user.id } } } },
          { invitations: { some: { invitedDog: { ownerId: user.id } } } }
        ]
      },
      select: { id: true }
    }),
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true } })
  ]);

  const capability: Record<string, string[]> = {};
  for (const walk of walks) {
    capability[realtimeChannels.messages(walk.id)] = ['subscribe', 'presence'];
    capability[realtimeChannels.walk(walk.id)] = ['subscribe'];
  }
  for (const dog of dogs) {
    capability[realtimeChannels.lostDog(dog.id)] = ['subscribe'];
  }

  const client = new Ably.Rest(apiKey);
  const tokenRequest = await client.auth.createTokenRequest({
    clientId: `user:${user.id}`,
    capability: JSON.stringify(capability),
    ttl: 60 * 60 * 1000
  });

  return NextResponse.json(tokenRequest);
}
