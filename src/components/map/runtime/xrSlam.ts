import type { ArTrackingSource } from '@/stores/useMapRuntimeStore';

export type XrVector3 = { x: number; y: number; z: number };
export type XrQuaternion = XrVector3 & { w: number };
export type XrPoseLike = {
  transform: {
    position: XrVector3;
    orientation: XrQuaternion;
  };
};
export type XrReferenceSpaceLike = object;
export type XrHitTestSourceLike = { cancel?: () => void };
export type XrHitTestResultLike = { getPose?: (space: XrReferenceSpaceLike) => XrPoseLike | null };
export type XrFrameLike = {
  getViewerPose: (space: XrReferenceSpaceLike) => XrPoseLike | null;
  getHitTestResults?: (source: XrHitTestSourceLike) => XrHitTestResultLike[];
};
export type XrWebGLLayerLike = {
  framebuffer: WebGLFramebuffer | null;
  framebufferWidth?: number;
  framebufferHeight?: number;
};
export type XrSessionLike = {
  enabledFeatures?: readonly string[];
  requestReferenceSpace: (type: 'local' | 'viewer') => Promise<XrReferenceSpaceLike>;
  requestHitTestSource?: (options: { space: XrReferenceSpaceLike }) => Promise<XrHitTestSourceLike>;
  requestAnimationFrame: (callback: (time: number, frame: XrFrameLike) => void) => number;
  updateRenderState: (state: { baseLayer?: XrWebGLLayerLike }) => void;
  addEventListener: (type: 'end', listener: () => void) => void;
  removeEventListener: (type: 'end', listener: () => void) => void;
  end: () => Promise<void>;
};
export type XrSystemLike = {
  isSessionSupported?: (mode: 'immersive-ar') => Promise<boolean>;
  requestSession: (
    mode: 'immersive-ar',
    options: {
      requiredFeatures: string[];
      optionalFeatures: string[];
      domOverlay: { root: Element };
    }
  ) => Promise<XrSessionLike>;
};
export type XrCompatibleGl = (WebGLRenderingContext | WebGL2RenderingContext) & {
  makeXRCompatible?: () => Promise<void>;
};
export type XrWebGLLayerConstructor = new (
  session: XrSessionLike,
  context: WebGLRenderingContext | WebGL2RenderingContext
) => XrWebGLLayerLike;

export type NativeArSource = 'arkit' | 'arcore';
export type NativeArBridge = {
  platform?: NativeArSource;
  start?: () => void | Promise<void>;
  stop?: () => void | Promise<void>;
};
export type NativeArPoseDetail = {
  source?: NativeArSource;
  trackingState?: 'tracking' | 'limited';
  position?: XrVector3;
  orientation?: XrQuaternion;
  latitude?: number;
  longitude?: number;
  heading?: number;
  surfaceTracked?: boolean;
};
export type NavigatorWithXr = Navigator & { xr?: XrSystemLike };
export type WindowWithArRuntimes = Window & {
  XRWebGLLayer?: XrWebGLLayerConstructor;
  BuddiesNativeAR?: NativeArBridge;
};

export type SlamCalibration = {
  latitude: number;
  longitude: number;
  heading: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
};

const METERS_PER_DEGREE_LATITUDE = 111_320;

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function normalizeLongitude(value: number) {
  return ((value + 540) % 360) - 180;
}

export function shortestAngularDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function yawDegrees(orientation: XrQuaternion) {
  const { x, y, z, w } = orientation;
  const radians = Math.atan2(
    2 * (w * y + x * z),
    1 - 2 * (y * y + z * z)
  );
  return normalizeDegrees(radians * 180 / Math.PI);
}

export function trackingSourceForNative(source: NativeArSource | undefined): ArTrackingSource {
  return source === 'arcore' ? 'arcore-native' : 'arkit-native';
}

export function trackingSourceForWebXr(userAgent: string): ArTrackingSource {
  return /Android/i.test(userAgent) ? 'arcore-webxr' : 'webxr-slam';
}

export function immersiveArSessionOptions(root: Element) {
  return {
    requiredFeatures: ['local'],
    optionalFeatures: ['dom-overlay', 'hit-test', 'anchors', 'light-estimation'],
    domOverlay: { root }
  };
}

export function geodeticFromLocalPose(
  calibration: SlamCalibration,
  position: XrVector3,
  orientation: XrQuaternion
) {
  const dx = position.x - calibration.x;
  const dy = position.y - calibration.y;
  const dz = position.z - calibration.z;
  const localEast = dx;
  const localNorth = -dz;
  const localNorthBearing = normalizeDegrees(calibration.heading + calibration.yaw);
  const angle = localNorthBearing * Math.PI / 180;
  const eastMeters = localEast * Math.cos(angle) + localNorth * Math.sin(angle);
  const northMeters = -localEast * Math.sin(angle) + localNorth * Math.cos(angle);
  const latitude = calibration.latitude + northMeters / METERS_PER_DEGREE_LATITUDE;
  const longitudeScale = METERS_PER_DEGREE_LATITUDE
    * Math.max(0.15, Math.cos(calibration.latitude * Math.PI / 180));
  const longitude = normalizeLongitude(calibration.longitude + eastMeters / longitudeScale);
  const currentYaw = yawDegrees(orientation);
  const heading = normalizeDegrees(
    calibration.heading - shortestAngularDelta(calibration.yaw, currentYaw)
  );

  return {
    latitude,
    longitude,
    heading,
    xMeters: dx,
    yMeters: dy,
    zMeters: dz
  };
}
