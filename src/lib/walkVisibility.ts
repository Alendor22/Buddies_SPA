import { Prisma, WalkInvitationStatus } from '@/generated/prisma/client';

export function walkParticipantWhere(userId: string): Prisma.WalkWhereInput {
  return {
    OR: [
      { requesterId: userId },
      { dog: { ownerId: userId } },
      {
        AND: [
          { walkerId: userId },
          { invitations: { none: {} } }
        ]
      },
      {
        invitations: {
          some: {
            status: WalkInvitationStatus.ACCEPTED,
            invitedDog: { ownerId: userId }
          }
        }
      }
    ]
  };
}
