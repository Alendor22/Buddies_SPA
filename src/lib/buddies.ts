export function orderedBuddyPair(userId: string, otherUserId: string) {
  if (userId < otherUserId) {
    return { userAId: userId, userBId: otherUserId };
  }

  return { userAId: otherUserId, userBId: userId };
}

export function orderedDogBuddyPair(dogId: string, otherDogId: string) {
  if (dogId < otherDogId) {
    return { dogAId: dogId, dogBId: otherDogId };
  }

  return { dogAId: otherDogId, dogBId: dogId };
}
