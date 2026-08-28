import { describe, expect, it } from 'vitest';
import { orderedBuddyPair, orderedDogBuddyPair } from '@/lib/buddies';
import { distanceMiles } from '@/lib/checkIns';
import { walkParticipantWhere } from '@/lib/walkVisibility';

describe('domain helpers', () => {
  it('canonicalizes owner and dog buddy pairs', () => {
    expect(orderedBuddyPair('user-z', 'user-a')).toEqual({ userAId: 'user-a', userBId: 'user-z' });
    expect(orderedDogBuddyPair('dog-a', 'dog-z')).toEqual({ dogAId: 'dog-a', dogBId: 'dog-z' });
  });

  it('calculates stable geographic distances', () => {
    expect(distanceMiles(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 40.7128, longitude: -74.006 }
    )).toBe(0);

    const nycToPhiladelphia = distanceMiles(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 39.9526, longitude: -75.1652 }
    );
    expect(nycToPhiladelphia).toBeGreaterThan(75);
    expect(nycToPhiladelphia).toBeLessThan(100);
  });

  it('keeps every walk visibility branch scoped to the current user', () => {
    expect(walkParticipantWhere('user-1')).toEqual({
      OR: [
        { requesterId: 'user-1' },
        { dog: { ownerId: 'user-1' } },
        {
          AND: [
            { walkerId: 'user-1' },
            { invitations: { none: {} } }
          ]
        },
        {
          invitations: {
            some: {
              status: 'ACCEPTED',
              invitedDog: { ownerId: 'user-1' }
            }
          }
        }
      ]
    });
  });
});
