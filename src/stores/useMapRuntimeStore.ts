'use client';

import { create } from 'zustand';

export type MapCameraMode = 'follow' | 'explore' | 'overview' | 'ar';
export type MapUiMode = 'normal' | 'walking' | 'route-planning' | 'navigation' | 'reporting' | 'dog-interaction' | 'lost-dog';
export type MotionClass = 'stationary' | 'likely-walking' | 'walking' | 'jogging' | 'paused' | 'possibly-driving';

export type MapLayerKey =
  | 'buddies'
  | 'dogs'
  | 'heat'
  | 'dog-parks'
  | 'water'
  | 'bags'
  | 'vets'
  | 'daycare'
  | 'boarding'
  | 'spas'
  | 'hazards'
  | 'reports'
  | 'lost-dogs';

export type SpatialEntitySelection = {
  id: string;
  kind: 'dog' | 'place' | 'report' | 'route' | 'buddy';
  latitude: number;
  longitude: number;
  title: string;
} | null;

export type WalkTelemetry = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  heading: number | null;
  currentSpeedMph: number;
  averageSpeedMph: number;
  distanceMiles: number;
  elapsedSeconds: number;
  movingSeconds: number;
  motionClass: MotionClass;
  confidence: number;
  updatedAt: string | null;
};

export type ActiveSpatialWalk = {
  id: string | null;
  autoDetected: boolean;
  startedAt: string | null;
  pausedAt: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
};

type MapRuntimeState = {
  cameraMode: MapCameraMode;
  uiMode: MapUiMode;
  followZoom: number;
  followPitch: number;
  bearing: number;
  selectedEntity: SpatialEntitySelection;
  layers: Record<MapLayerKey, boolean>;
  telemetry: WalkTelemetry;
  activeWalk: ActiveSpatialWalk;
  setCameraMode: (mode: MapCameraMode) => void;
  setUiMode: (mode: MapUiMode) => void;
  setBearing: (bearing: number) => void;
  setFollowCamera: (input: Partial<Pick<MapRuntimeState, 'followZoom' | 'followPitch'>>) => void;
  toggleLayer: (layer: MapLayerKey) => void;
  setLayerVisible: (layer: MapLayerKey, visible: boolean) => void;
  selectEntity: (selection: SpatialEntitySelection) => void;
  patchTelemetry: (telemetry: Partial<WalkTelemetry>) => void;
  startWalk: (input?: Partial<ActiveSpatialWalk>) => void;
  pauseWalk: () => void;
  endWalk: () => void;
  resetTelemetry: () => void;
};

const initialTelemetry: WalkTelemetry = {
  latitude: null,
  longitude: null,
  accuracyMeters: null,
  heading: null,
  currentSpeedMph: 0,
  averageSpeedMph: 0,
  distanceMiles: 0,
  elapsedSeconds: 0,
  movingSeconds: 0,
  motionClass: 'stationary',
  confidence: 0,
  updatedAt: null
};

const initialWalk: ActiveSpatialWalk = {
  id: null,
  autoDetected: false,
  startedAt: null,
  pausedAt: null,
  startLatitude: null,
  startLongitude: null
};

export const useMapRuntimeStore = create<MapRuntimeState>((set) => ({
  cameraMode: 'follow',
  uiMode: 'normal',
  followZoom: 18.7,
  followPitch: 68,
  bearing: 0,
  selectedEntity: null,
  layers: {
    buddies: true,
    dogs: true,
    heat: false,
    'dog-parks': true,
    water: true,
    bags: true,
    vets: true,
    daycare: true,
    boarding: true,
    spas: true,
    hazards: true,
    reports: true,
    'lost-dogs': true
  },
  telemetry: initialTelemetry,
  activeWalk: initialWalk,
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setUiMode: (uiMode) => set({ uiMode }),
  setBearing: (bearing) => set({ bearing: ((bearing % 360) + 360) % 360 }),
  setFollowCamera: (input) => set((state) => ({
    followZoom: input.followZoom ?? state.followZoom,
    followPitch: input.followPitch ?? state.followPitch
  })),
  toggleLayer: (layer) => set((state) => ({
    layers: { ...state.layers, [layer]: !state.layers[layer] }
  })),
  setLayerVisible: (layer, visible) => set((state) => ({
    layers: { ...state.layers, [layer]: visible }
  })),
  selectEntity: (selectedEntity) => set({ selectedEntity }),
  patchTelemetry: (telemetry) => set((state) => ({
    telemetry: { ...state.telemetry, ...telemetry }
  })),
  startWalk: (input = {}) => set((state) => ({
    uiMode: 'walking',
    activeWalk: {
      id: input.id ?? state.activeWalk.id,
      autoDetected: input.autoDetected ?? false,
      startedAt: input.startedAt ?? new Date().toISOString(),
      pausedAt: null,
      startLatitude: input.startLatitude ?? state.telemetry.latitude,
      startLongitude: input.startLongitude ?? state.telemetry.longitude
    }
  })),
  pauseWalk: () => set((state) => ({
    activeWalk: { ...state.activeWalk, pausedAt: new Date().toISOString() }
  })),
  endWalk: () => set({ uiMode: 'normal', activeWalk: initialWalk }),
  resetTelemetry: () => set({ telemetry: initialTelemetry })
}));
