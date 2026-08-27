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

export type ArTrackingSource =
  | 'none'
  | 'sensor-fusion'
  | 'arcore-webxr'
  | 'webxr-slam'
  | 'arkit-native'
  | 'arcore-native';

export type ArTrackingState = 'idle' | 'initializing' | 'tracking' | 'limited' | 'unsupported' | 'error';

export type ArSpatialTracking = {
  source: ArTrackingSource;
  state: ArTrackingState;
  anchorLatitude: number | null;
  anchorLongitude: number | null;
  heading: number | null;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  message: string | null;
  updatedAt: string | null;
};

type MapRuntimeState = {
  cameraMode: MapCameraMode;
  uiMode: MapUiMode;
  followZoom: number;
  followPitch: number;
  bearing: number;
  arOverlayOpacity: number;
  arFieldOfViewDegrees: number;
  arDevicePitch: number | null;
  arDeviceRoll: number | null;
  arTracking: ArSpatialTracking;
  selectedEntity: SpatialEntitySelection;
  layers: Record<MapLayerKey, boolean>;
  telemetry: WalkTelemetry;
  activeWalk: ActiveSpatialWalk;
  setCameraMode: (mode: MapCameraMode) => void;
  setUiMode: (mode: MapUiMode) => void;
  setBearing: (bearing: number) => void;
  setFollowCamera: (input: Partial<Pick<MapRuntimeState, 'followZoom' | 'followPitch'>>) => void;
  setArOverlayOpacity: (opacity: number) => void;
  setArFieldOfViewDegrees: (degrees: number) => void;
  setArOrientation: (input: { heading?: number | null; pitch?: number | null; roll?: number | null }) => void;
  patchArTracking: (tracking: Partial<ArSpatialTracking>) => void;
  resetArTracking: () => void;
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

const initialArTracking: ArSpatialTracking = {
  source: 'none',
  state: 'idle',
  anchorLatitude: null,
  anchorLongitude: null,
  heading: null,
  xMeters: 0,
  yMeters: 0,
  zMeters: 0,
  message: null,
  updatedAt: null
};

function normalizeBearing(value: number) {
  return ((value % 360) + 360) % 360;
}

export const useMapRuntimeStore = create<MapRuntimeState>((set) => ({
  cameraMode: 'follow',
  uiMode: 'normal',
  followZoom: 18.7,
  followPitch: 68,
  bearing: 0,
  arOverlayOpacity: 0.42,
  arFieldOfViewDegrees: 68,
  arDevicePitch: null,
  arDeviceRoll: null,
  arTracking: initialArTracking,
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
  setBearing: (bearing) => set({ bearing: normalizeBearing(bearing) }),
  setFollowCamera: (input) => set((state) => ({
    followZoom: input.followZoom ?? state.followZoom,
    followPitch: input.followPitch ?? state.followPitch
  })),
  setArOverlayOpacity: (arOverlayOpacity) => set({
    arOverlayOpacity: Math.max(0.15, Math.min(0.85, arOverlayOpacity))
  }),
  setArFieldOfViewDegrees: (arFieldOfViewDegrees) => set({
    arFieldOfViewDegrees: Math.max(45, Math.min(100, arFieldOfViewDegrees))
  }),
  setArOrientation: ({ heading, pitch, roll }) => set((state) => ({
    bearing: heading == null ? state.bearing : normalizeBearing(heading),
    arDevicePitch: pitch === undefined ? state.arDevicePitch : pitch,
    arDeviceRoll: roll === undefined ? state.arDeviceRoll : roll
  })),
  patchArTracking: (tracking) => set((state) => ({
    arTracking: {
      ...state.arTracking,
      ...tracking,
      heading: typeof tracking.heading === 'number'
        ? normalizeBearing(tracking.heading)
        : tracking.heading === null
          ? null
          : state.arTracking.heading
    }
  })),
  resetArTracking: () => set({ arTracking: initialArTracking }),
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
