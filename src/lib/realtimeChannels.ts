export const realtimeChannels = {
  lostDog: (dogId: string) => `dog:${dogId}:lost`,
  walk: (walkId: string) => `walk:${walkId}`,
  messages: (walkId: string) => `walk:${walkId}:messages`,
  conversation: (conversationId: string) => `conversation:${conversationId}:messages`,
  conversationTyping: (conversationId: string) => `conversation:${conversationId}:typing`,
  userNotifications: (userId: string) => `user:${userId}:notifications`,
  nearby: (cell: string) => `nearby:${cell}`
} as const;
