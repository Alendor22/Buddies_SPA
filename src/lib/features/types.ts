export type FeatureStatus = 'registered' | 'flagged' | 'permissioned' | 'observable' | 'releasable' | 'deprecated';
export type FeatureCategory = 'core' | 'identity' | 'social' | 'maps' | 'marketplace' | 'safety' | 'recognition' | 'scanner' | 'ai' | 'xr' | 'admin';
export type BuddiesRole = 'OWNER' | 'WALKER' | 'ADMIN';
export type CloudflarePolicyName = 'public-read' | 'authenticated-api' | 'sensitive-write' | 'media-upload' | 'scanner-public' | 'admin-only';
export type FeatureDefinition = { id: string; label: string; href: string; icon: string; description: string; category: FeatureCategory; status: FeatureStatus; requiresAuth: boolean; roles?: BuddiesRole[]; flag?: string; telemetryNamespace: `feature.${string}`; cloudflarePolicy: CloudflarePolicyName; redisKeys?: string[]; match: (pathname: string) => boolean };
