export const UI_ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  profiles: '/dogs',
  addProfile: '/dogs/new',
  buddies: '/dashboard/buddies',
  buddyRequests: '/dashboard/buddies#buddy-requests',
  walks: '/dashboard/walks',
  createWalk: '/dashboard/walks/new',
  walkInvites: '/dashboard/walks#walk-invitations',
  alerts: '/dashboard/notifications',
  lostReport: '/dashboard/lost/report',
  records: '/dashboard/records',
  account: '/dashboard/menu'
} as const;

export type UiRouteKey = keyof typeof UI_ROUTES;

export function uiRoute(key: UiRouteKey) {
  return UI_ROUTES[key];
}

export function dogProfileRoute(slug: string) {
  return `/dogs/${encodeURIComponent(slug)}`;
}

export function dogLostRoute(slug: string) {
  return `${dogProfileRoute(slug)}#lost-dog`;
}

export function dogWalkInvitesRoute(slug: string) {
  return `${dogProfileRoute(slug)}#walk-invitations`;
}

export function dogSightingRoute(slug: string) {
  return `${dogProfileRoute(slug)}/sighting`;
}
