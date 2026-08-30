const safe = (value: string) => encodeURIComponent(value);

export const redisKeys = {
  ui: { ribbon: (userId: string) => `ui:user:${safe(userId)}:features-ribbon`, theme: (userId: string) => `ui:user:${safe(userId)}:theme` },
  auth: { user: (clerkId: string) => `auth:user:${safe(clerkId)}`, roles: (userId: string) => `auth:roles:${safe(userId)}` },
  features: { flag: (featureId: string) => `feature:flag:${safe(featureId)}`, userFlag: (featureId: string, userId: string) => `feature:flag:${safe(featureId)}:user:${safe(userId)}` },
  identity: { user: (userId: string) => `identity:user:${safe(userId)}`, dog: (dogId: string) => `identity:dog:${safe(dogId)}`, dogSlug: (slug: string) => `identity:dog:slug:${safe(slug)}`, shareGrant: (tokenHash: string) => `identity:dog-share:${safe(tokenHash)}` },
  notifications: { unread: (userId: string) => `notifications:unread:${safe(userId)}` },
  search: { recent: (userId: string) => `search:recent:${safe(userId)}`, result: (hash: string) => `search:cache:${safe(hash)}` },
  rateLimit: (scope: string, subject: string) => `rate:${safe(scope)}:${safe(subject)}`,
} as const;

export const redisTtl = { featureFlagSeconds: 60, authUserSeconds: 300, identityUserSeconds: 300, identityDogSeconds: 300, searchSeconds: 120, uiPreferenceSeconds: 2592000, shareGrantSeconds: 86400 } as const;
