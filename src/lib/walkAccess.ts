import { prisma } from '@/lib/db';

export async function getWalkAccess(walkId: string, userId: string) {
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: {
      dog: { select: { id: true, name: true, slug: true, ownerId: true, photoUrl: true } },
      invitations: {
        include: {
          senderDog: { select: { id: true, name: true, slug: true, ownerId: true } },
          invitedDog: { select: { id: true, name: true, slug: true, ownerId: true } }
        }
      }
    }
  });

  if (!walk) return null;

  const participantIds = new Set<string>([walk.requesterId, walk.dog.ownerId]);
  if (walk.walkerId) participantIds.add(walk.walkerId);

  const labels = new Map<string, string>();
  labels.set(walk.requesterId, walk.dog.name);
  labels.set(walk.dog.ownerId, walk.dog.name);

  for (const invitation of walk.invitations) {
    participantIds.add(invitation.senderDog.ownerId);
    participantIds.add(invitation.invitedDog.ownerId);
    labels.set(invitation.senderDog.ownerId, invitation.senderDog.name);
    labels.set(invitation.invitedDog.ownerId, invitation.invitedDog.name);
  }

  if (!participantIds.has(userId)) return null;

  return {
    walk,
    participantIds: Array.from(participantIds),
    labels,
    currentLabel: labels.get(userId) ?? 'Walk participant'
  };
}
