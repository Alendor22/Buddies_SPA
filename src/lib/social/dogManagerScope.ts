import { DogCustodianRole, type Prisma } from '@/generated/prisma/client';

export function dogManagerScope(userId: string): Prisma.DogWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { custodians: { some: { userId, role: { in: [DogCustodianRole.OWNER, DogCustodianRole.CAREGIVER] } } } }
    ]
  };
}
