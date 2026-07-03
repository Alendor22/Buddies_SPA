export function orderedBuddyPair(userId: string, otherUserId: string) {
  if (userId < otherUserId) {
    return { userAId: userId, userBId: otherUserId };
  }

  return { userAId: otherUserId, userBId: userId };
}
