import { WalkInvitationStatus } from '@prisma/client';
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
  const labels = new Map<string, string>();
  labels.set(walk.requesterId, walk.dog.name);
  labels.set(walk.dog.ownerId, walk.dog.name);

  const acceptedInvitations = walk.invitations.filter(
    (invitation) => invitation.status === WalkInvitationStatus.ACCEPTED
  );
  const acceptedWalkerIds = new Set(acceptedInvitations.map((invitation) => invitation.invitedDog.ownerId));

  if (walk.walkerId && (!walk.invitations.length || acceptedWalkerIds.has(walk.walkerId))) {
    participantIds.add(walk.walkerId);
  }

  for (const invitation of acceptedInvitations) {
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
