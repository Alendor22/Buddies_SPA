export const realtimeChannels = {
  lostDog: (dogId: string) => `dog:${dogId}:lost`,
  walk: (walkId: string) => `walk:${walkId}`,
  messages: (walkId: string) => `walk:${walkId}:messages`,
  conversation: (conversationId: string) => `conversation:${conversationId}:messages`,
  nearby: (cell: string) => `nearby:${cell}`
} as const;
