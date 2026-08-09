'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Coordinate = { lat: number; lng: number };
export type MapMode = 'pan' | 'start' | 'apex' | 'waypoint';
export type RoutingState = 'idle' | 'plotting' | 'routing' | 'success' | 'timeout' | 'error' | 'cancelled';

export type SavedRoute = {
  id: string;
  name: string;
  createdAt: string;
  routeJson: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
};

export type BuddyRequestPairState = {
  direction: 'OUTGOING' | 'INCOMING';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  requestId: string;
};

export type BuddyRequestViewState = {
  pair?: BuddyRequestPairState;
  pending: boolean;
  feedback: string;
};

export type WalkPlannerState = {
  /** Runtime-only compatibility field. Never persisted. MapboxProvider is the configuration authority. */
  token: string;
  tokenCachedAt: number | null;
  center: Coordinate;
  start: Coordinate | null;
  apex: Coordinate | null;
  waypoints: Coordinate[];
  mode: MapMode;
  status: string;
  apexMiles: number;
  routeName: string;
  route: Coordinate[];
  routeSteps: string[];
  distanceMiles: number | null;
  durationMinutes: number | null;
  favorites: SavedRoute[];
  viewFeet: number;
  routingState: RoutingState;
  routingError: string | null;
  savingFavorite: boolean;
  mapLoaded: boolean;
  mapUpdatedAt: number | null;
};

type BuddiesStore = {
  walkPlanner: WalkPlannerState;
  buddyRequests: Record<string, BuddyRequestViewState>;
  hydrateMapToken: (token: string) => void;
  patchWalkPlanner: (patch: Partial<WalkPlannerState>) => void;
  setMapCenter: (center: Coordinate) => void;
  setStart: (start: Coordinate) => void;
  setWaypoints: (waypoints: Coordinate[]) => void;
  setRoutingState: (routingState: RoutingState, routingError?: string | null) => void;
  resetRoute: () => void;
  resetWalkPlanner: () => void;
  initializeBuddyRequest: (key: string, pair?: BuddyRequestPairState) => void;
  patchBuddyRequest: (key: string, patch: Partial<BuddyRequestViewState>) => void;
  clearBuddyRequest: (key: string) => void;
};

export const DEFAULT_CENTER: Coordinate = { lat: 40.685743, lng: -73.941329 };
export const DEFAULT_VIEW_FEET = 20000;

const defaultWalkPlanner = (): WalkPlannerState => ({
  token: '',
  tokenCachedAt: null,
  center: DEFAULT_CENTER,
  start: DEFAULT_CENTER,
  apex: null,
  waypoints: [],
  mode: 'pan',
  status: 'Short press the map to set Start. Long press to add a waypoint.',
  apexMiles: 0.5,
  routeName: 'Neighborhood walk',
  route: [],
  routeSteps: [],
  distanceMiles: null,
  durationMinutes: null,
  favorites: [],
  viewFeet: DEFAULT_VIEW_FEET,
  routingState: 'idle',
  routingError: null,
  savingFavorite: false,
  mapLoaded: false,
  mapUpdatedAt: null
});

export const useBuddiesStore = create<BuddiesStore>()(
  persist(
    (set) => ({
      walkPlanner: defaultWalkPlanner(),
      buddyRequests: {},

      // Transitional runtime hydration only. This will be removed once every map consumer reads MapboxProvider directly.
      hydrateMapToken: (token) => {
        if (!token) return;
        set((state) => ({ walkPlanner: { ...state.walkPlanner, token, tokenCachedAt: Date.now() } }));
      },

      patchWalkPlanner: (patch) => set((state) => ({
        walkPlanner: {
          ...state.walkPlanner,
          ...patch,
          mapUpdatedAt: patch.mapUpdatedAt === undefined ? Date.now() : patch.mapUpdatedAt
        }
      })),

      setMapCenter: (center) => set((state) => ({
        walkPlanner: { ...state.walkPlanner, center, mapUpdatedAt: Date.now() }
      })),

      setStart: (start) => set((state) => ({
        walkPlanner: { ...state.walkPlanner, start, center: start, mapUpdatedAt: Date.now() }
      })),

      setWaypoints: (waypoints) => set((state) => ({
        walkPlanner: { ...state.walkPlanner, waypoints, mapUpdatedAt: Date.now() }
      })),

      setRoutingState: (routingState, routingError = null) => set((state) => ({
        walkPlanner: { ...state.walkPlanner, routingState, routingError, mapUpdatedAt: Date.now() }
      })),

      resetRoute: () => set((state) => ({
        walkPlanner: {
          ...state.walkPlanner,
          route: [],
          routeSteps: [],
          distanceMiles: null,
          durationMinutes: null,
          routingState: state.walkPlanner.waypoints.length ? 'plotting' : 'idle',
          routingError: null,
          mapUpdatedAt: Date.now()
        }
      })),

      resetWalkPlanner: () => set(() => ({ walkPlanner: defaultWalkPlanner() })),

      initializeBuddyRequest: (key, pair) => set((state) => ({
        buddyRequests: { ...state.buddyRequests, [key]: { pair, pending: false, feedback: '' } }
      })),

      patchBuddyRequest: (key, patch) => set((state) => ({
        buddyRequests: {
          ...state.buddyRequests,
          [key]: {
            pair: state.buddyRequests[key]?.pair,
            pending: state.buddyRequests[key]?.pending ?? false,
            feedback: state.buddyRequests[key]?.feedback ?? '',
            ...patch
          }
        }
      })),

      clearBuddyRequest: (key) => set((state) => {
        const next = { ...state.buddyRequests };
        delete next[key];
        return { buddyRequests: next };
      })
    }),
    {
      name: 'buddies-session-state-v5',
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        walkPlanner: {
          ...state.walkPlanner,
          token: '',
          tokenCachedAt: null,
          favorites: [],
          routingState: 'idle' as const,
          routingError: null,
          savingFavorite: false,
          mapLoaded: false
        },
        buddyRequests: {}
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<BuddiesStore>;
        const persistedPlanner = persisted.walkPlanner;
        return {
          ...currentState,
          walkPlanner: {
            ...currentState.walkPlanner,
            ...(persistedPlanner ?? {}),
            token: '',
            tokenCachedAt: null,
            viewFeet: persistedPlanner?.viewFeet && persistedPlanner.viewFeet > DEFAULT_VIEW_FEET ? persistedPlanner.viewFeet : DEFAULT_VIEW_FEET,
            apexMiles: persistedPlanner?.apexMiles && persistedPlanner.apexMiles <= 1 ? persistedPlanner.apexMiles : 0.5
          },
          buddyRequests: {}
        };
      }
    }
  )
);
