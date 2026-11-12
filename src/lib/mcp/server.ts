import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { walkParticipantWhere } from '@/lib/walkVisibility';

function userIdFrom(extra: { authInfo?: { extra?: Record<string, unknown> } }) {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || !userId) throw new Error('Missing authenticated user context.');
  return userId;
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

// A fresh McpServer per request (see src/app/api/mcp/route.ts) is the pattern the SDK
// documents for stateless/serverless deployments — there is no shared process state
// between Vercel function invocations to register tools against once.
export function createBuddiesMcpServer() {
  const server = new McpServer({ name: 'buddies-spa', version: '1.0.0' });

  server.registerTool(
    'list_my_dogs',
    {
      title: 'List my dogs',
      description: "List the signed-in user's own dog profiles (id, name, slug, breed, status)."
    },
    async (extra) => {
      const userId = userIdFrom(extra);
      const dogs = await prisma.dog.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, slug: true, breed: true, status: true, lostSince: true }
      });
      return jsonResult({ dogs });
    }
  );

  server.registerTool(
    'get_dog_profile',
    {
      title: 'Get dog profile',
      description: "Get full profile details for one of the signed-in user's own dogs, by slug.",
      inputSchema: { slug: z.string().trim().min(1) }
    },
    async ({ slug }, extra) => {
      const userId = userIdFrom(extra);
      const dog = await prisma.dog.findFirst({
        where: { slug, ownerId: userId },
        select: {
          id: true,
          name: true,
          slug: true,
          breed: true,
          birthDate: true,
          weightLbs: true,
          gender: true,
          status: true,
          temperament: true,
          medicalNotes: true,
          vaccinationNotes: true,
          emergencyContact: true,
          lostSince: true,
          lastSeenLocation: true,
          lostReward: true,
          lostNotes: true,
          spayedNeutered: true,
          friendlyDogs: true,
          friendlyCats: true,
          friendlyChildren: true,
          createdAt: true
        }
      });
      if (!dog) return { content: [{ type: 'text' as const, text: 'No dog with that slug was found on this account.' }], isError: true };
      return jsonResult({ dog });
    }
  );

  server.registerTool(
    'list_my_walks',
    {
      title: 'List my walks',
      description: 'List recent and upcoming walks the signed-in user is a participant in.'
    },
    async (extra) => {
      const userId = userIdFrom(extra);
      const walks = await prisma.walk.findMany({
        where: walkParticipantWhere(userId),
        orderBy: { startsAt: 'desc' },
        take: 25,
        select: {
          id: true,
          startsAt: true,
          durationMin: true,
          status: true,
          notes: true,
          dog: { select: { name: true, slug: true } }
        }
      });
      return jsonResult({ walks });
    }
  );

  server.registerTool(
    'list_unread_notifications',
    {
      title: 'List unread notifications',
      description: "List the signed-in user's unread Buddies notifications."
    },
    async (extra) => {
      const userId = userIdFrom(extra);
      const notifications = await prisma.notification.findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, routeKey: true, title: true, body: true, href: true, createdAt: true }
      });
      return jsonResult({ notifications });
    }
  );

  return server;
}
