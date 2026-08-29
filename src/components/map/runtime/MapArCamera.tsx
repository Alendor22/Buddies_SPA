'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapRuntimeStore, type ArTrackingSource } from '@/stores/useMapRuntimeStore';
import type { ArCameraStatus } from './arTypes';
import {
  geodeticFromLocalPose,
  immersiveArSessionOptions,
  trackingSourceForNative,
  trackingSourceForWebXr,
  yawDegrees,
  type NativeArPoseDetail,
  type NavigatorWithXr,
  type SlamCalibration,
  type WindowWithArRuntimes,
  type XrCompatibleGl,
  type XrFrameLike,
  type XrHitTestSourceLike,
  type XrQuaternion,
  type XrSessionLike,
  type XrVector3,
  type XrWebGLLayerLike
} from './xrSlam';

const POSE_PATCH_INTERVAL_MS = 33;

function emitStatus(status: ArCameraStatus, message: string) {
  window.dispatchEvent(new CustomEvent('buddies:ar-camera-status', {
    detail: { status, message }
  }));
}

export default function MapArCamera() {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const trackingSource = useMapRuntimeStore((state) => state.arTracking.source);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rootLocatorRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const xrSessionRef = useRef<XrSessionLike | null>(null);
  const xrHitTestSourceRef = useRef<XrHitTestSourceLike | null>(null);
  const xrGlRef = useRef<XrCompatibleGl | null>(null);
  const xrLayerRef = useRef<XrWebGLLayerLike | null>(null);
  const xrSurfaceTrackedRef = useRef(false);
  const nativeBridgeStartedRef = useRef(false);
  const calibrationRef = useRef<SlamCalibration | null>(null);
  const lastPosePatchRef = useRef(0);
  const explicitStopRef = useRef(false);
  const savedOverlayBackgroundRef = useRef<string | null>(null);
  const trackingRequestActiveRef = useRef(false);
  const runtimeGenerationRef = useRef(0);
  const [status, setStatus] = useState<ArCameraStatus>('idle');

  const resolveOverlayRoot = useCallback((): HTMLElement => {
    return rootLocatorRef.current?.closest('main') ?? document.body;
  }, []);

  const setOverlayTransparent = useCallback((transparent: boolean) => {
    const root = resolveOverlayRoot();
    if (transparent) {
      if (savedOverlayBackgroundRef.current == null) {
        savedOverlayBackgroundRef.current = root.style.backgroundColor;
      }
      root.style.backgroundColor = 'transparent';
      return;
    }

    if (savedOverlayBackgroundRef.current != null) {
      root.style.backgroundColor = savedOverlayBackgroundRef.current;
      savedOverlayBackgroundRef.current = null;
    } else {
      root.style.removeProperty('background-color');
    }
  }, [resolveOverlayRoot]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearXrResources = useCallback(() => {
    xrHitTestSourceRef.current?.cancel?.();
    xrHitTestSourceRef.current = null;
    xrSurfaceTrackedRef.current = false;
    xrGlRef.current = null;
    xrLayerRef.current = null;
    calibrationRef.current = null;
  }, []);

  const startFallbackCamera = useCallback(async () => {
    const generation = runtimeGenerationRef.current;

    if (streamRef.current) {
      setStatus('ready');
      emitStatus('ready', 'Rear camera is live with stabilized sensor-fusion tracking.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      emitStatus('unavailable', 'Camera access is unavailable in this browser.');
      useMapRuntimeStore.getState().patchArTracking({
        source: 'sensor-fusion',
        state: 'unsupported',
        message: 'Camera access unavailable.',
        updatedAt: new Date().toISOString()
      });
      return;
    }

    setStatus('requesting');
    emitStatus('requesting', 'Starting stabilized camera fallback…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (generation !== runtimeGenerationRef.current || useMapRuntimeStore.getState().cameraMode !== 'ar') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }

      if (generation !== runtimeGenerationRef.current || useMapRuntimeStore.getState().cameraMode !== 'ar') {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        return;
      }

      const state = useMapRuntimeStore.getState();
      state.patchArTracking({
        source: 'sensor-fusion',
        state: 'limited',
        anchorLatitude: state.telemetry.latitude,
        anchorLongitude: state.telemetry.longitude,
        message: 'Browser SLAM unavailable; using stabilized GPS + inertial heading.',
        updatedAt: new Date().toISOString()
      });
      setStatus('ready');
      emitStatus('ready', 'Rear camera live. Browser SLAM is unavailable here; stabilized GPS + inertial tracking is active.');
    } catch (error) {
      if (generation !== runtimeGenerationRef.current) return;
      const denied = error instanceof DOMException
        && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      const nextStatus: ArCameraStatus = denied ? 'denied' : 'error';
      const message = denied
        ? 'Camera permission was denied. Allow camera access for Buddies and tap AR again.'
        : 'Rear camera could not be started.';
      setStatus(nextStatus);
      emitStatus(nextStatus, message);
      useMapRuntimeStore.getState().patchArTracking({
        source: 'sensor-fusion',
        state: 'error',
        message,
        updatedAt: new Date().toISOString()
      });
    }
  }, []);

  const beginFallback = useCallback((reason: string) => {
    if (useMapRuntimeStore.getState().cameraMode !== 'ar') return;
    const state = useMapRuntimeStore.getState();
    state.patchArTracking({
      source: 'sensor-fusion',
      state: 'limited',
      anchorLatitude: state.telemetry.latitude,
      anchorLongitude: state.telemetry.longitude,
      heading: null,
      xMeters: 0,
      yMeters: 0,
      zMeters: 0,
      message: reason,
      updatedAt: new Date().toISOString()
    });
    calibrationRef.current = null;
    setOverlayTransparent(false);
    window.dispatchEvent(new CustomEvent('buddies:ar-camera-request'));
  }, [setOverlayTransparent]);

  const patchLocalPose = useCallback((
    source: ArTrackingSource,
    position: XrVector3,
    orientation: XrQuaternion,
    trackingState: 'tracking' | 'limited' = 'tracking',
    surfaceTracked = false
  ) => {
    const now = performance.now();
    if (now - lastPosePatchRef.current < POSE_PATCH_INTERVAL_MS) return;
    lastPosePatchRef.current = now;

    const state = useMapRuntimeStore.getState();
    let calibration = calibrationRef.current;

    if (!calibration && state.telemetry.latitude != null && state.telemetry.longitude != null) {
      calibration = {
        latitude: state.telemetry.latitude,
        longitude: state.telemetry.longitude,
        heading: state.bearing,
        x: position.x,
        y: position.y,
        z: position.z,
        yaw: yawDegrees(orientation)
      };
      calibrationRef.current = calibration;
    }

    if (!calibration) {
      state.patchArTracking({
        source,
        state: 'limited',
        heading: state.bearing,
        message: surfaceTracked
          ? 'SLAM surface map acquired; waiting for a geographic origin.'
          : 'SLAM pose acquired; waiting for a geographic origin.',
        updatedAt: new Date().toISOString()
      });
      return;
    }

    const pose = geodeticFromLocalPose(calibration, position, orientation);
    state.patchArTracking({
      source,
      state: trackingState,
      anchorLatitude: pose.latitude,
      anchorLongitude: pose.longitude,
      heading: pose.heading,
      xMeters: pose.xMeters,
      yMeters: pose.yMeters,
      zMeters: pose.zMeters,
      message: trackingState === 'tracking'
        ? surfaceTracked
          ? 'Visual-inertial SLAM and surface tracking locked.'
          : 'Visual-inertial SLAM tracking locked.'
        : 'SLAM tracking is temporarily limited.',
      updatedAt: new Date().toISOString()
    });
  }, []);

  const initializeXrSession = useCallback(async (
    session: XrSessionLike,
    source: ArTrackingSource,
    generation: number
  ) => {
    xrSessionRef.current = session;
    clearXrResources();
    lastPosePatchRef.current = 0;
    setOverlayTransparent(true);
    stopCamera();

    const referenceSpace = await session.requestReferenceSpace('local');
    if (generation !== runtimeGenerationRef.current) throw new Error('stale-xr-session');

    if (session.requestHitTestSource) {
      try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        if (generation !== runtimeGenerationRef.current) throw new Error('stale-xr-session');
        xrHitTestSourceRef.current = await session.requestHitTestSource({ space: viewerSpace });
      } catch (error) {
        if (generation !== runtimeGenerationRef.current) throw error;
        xrHitTestSourceRef.current = null;
      }
    }

    const LayerCtor = (window as WindowWithArRuntimes).XRWebGLLayer;
    if (LayerCtor) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const gl = (
        canvas.getContext('webgl2', { alpha: true, antialias: false })
        ?? canvas.getContext('webgl', { alpha: true, antialias: false })
      ) as XrCompatibleGl | null;

      if (gl) {
        if (typeof gl.makeXRCompatible === 'function') await gl.makeXRCompatible();
        if (generation !== runtimeGenerationRef.current) throw new Error('stale-xr-session');
        const layer = new LayerCtor(session, gl);
        xrGlRef.current = gl;
        xrLayerRef.current = layer;
        session.updateRenderState({ baseLayer: layer });
      }
    }

    const handleEnd = () => {
      session.removeEventListener('end', handleEnd);
      const ownsRuntime = xrSessionRef.current === session;
      if (ownsRuntime) {
        xrSessionRef.current = null;
        clearXrResources();
        setOverlayTransparent(false);
      }

      if (!ownsRuntime || explicitStopRef.current || generation !== runtimeGenerationRef.current) return;
      if (useMapRuntimeStore.getState().cameraMode === 'ar') {
        beginFallback('The immersive SLAM session ended; stabilized sensor fusion is active.');
      }
    };

    session.addEventListener('end', handleEnd);

    const renderFrame = (_time: number, frame: XrFrameLike) => {
      if (xrSessionRef.current !== session || generation !== runtimeGenerationRef.current) return;

      const gl = xrGlRef.current;
      const layer = xrLayerRef.current;
      if (gl && layer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.viewport(0, 0, layer.framebufferWidth ?? 1, layer.framebufferHeight ?? 1);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }

      const hitSource = xrHitTestSourceRef.current;
      if (hitSource && frame.getHitTestResults) {
        xrSurfaceTrackedRef.current = frame.getHitTestResults(hitSource).length > 0;
      }

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        patchLocalPose(
          source,
          pose.transform.position,
          pose.transform.orientation,
          'tracking',
          xrSurfaceTrackedRef.current
        );
      } else {
        const state = useMapRuntimeStore.getState();
        if (state.arTracking.state !== 'limited') {
          state.patchArTracking({
            source,
            state: 'limited',
            message: 'SLAM tracking is reacquiring the environment.',
            updatedAt: new Date().toISOString()
          });
        }
      }

      session.requestAnimationFrame(renderFrame);
    };

    const hitTestEnabled = session.enabledFeatures?.includes('hit-test') || Boolean(xrHitTestSourceRef.current);
    useMapRuntimeStore.getState().patchArTracking({
      source,
      state: 'initializing',
      message: source === 'arcore-webxr'
        ? hitTestEnabled
          ? 'ARCore WebXR SLAM started; acquiring pose and real-world surfaces.'
          : 'ARCore WebXR SLAM started; acquiring visual-inertial pose.'
        : hitTestEnabled
          ? 'WebXR SLAM started; acquiring pose and real-world surfaces.'
          : 'WebXR SLAM started; acquiring visual-inertial pose.',
      updatedAt: new Date().toISOString()
    });
    setStatus('ready');
    emitStatus(
      'ready',
      source === 'arcore-webxr'
        ? 'ARCore SLAM active. Move naturally while the spatial map stabilizes.'
        : 'WebXR SLAM active. Move naturally while the spatial map stabilizes.'
    );
    session.requestAnimationFrame(renderFrame);
  }, [beginFallback, clearXrResources, patchLocalPose, setOverlayTransparent, stopCamera]);

  const startTracking = useCallback(() => {
    if (trackingRequestActiveRef.current || xrSessionRef.current || nativeBridgeStartedRef.current) return;

    const generation = runtimeGenerationRef.current + 1;
    runtimeGenerationRef.current = generation;
    trackingRequestActiveRef.current = true;
    explicitStopRef.current = false;
    calibrationRef.current = null;
    xrSurfaceTrackedRef.current = false;
    lastPosePatchRef.current = 0;

    const state = useMapRuntimeStore.getState();
    state.patchArTracking({
      source: 'none',
      state: 'initializing',
      anchorLatitude: state.telemetry.latitude,
      anchorLongitude: state.telemetry.longitude,
      heading: null,
      xMeters: 0,
      yMeters: 0,
      zMeters: 0,
      message: 'Selecting the best available 6DoF tracking runtime.',
      updatedAt: new Date().toISOString()
    });
    setStatus('requesting');
    emitStatus('requesting', 'Starting spatial tracking…');

    const nativeBridge = (window as WindowWithArRuntimes).BuddiesNativeAR;
    if (nativeBridge?.start) {
      const source = trackingSourceForNative(nativeBridge.platform);
      nativeBridgeStartedRef.current = true;
      setOverlayTransparent(true);
      stopCamera();
      state.patchArTracking({
        source,
        state: 'initializing',
        message: source === 'arkit-native'
          ? 'ARKit world tracking is initializing.'
          : 'ARCore native tracking is initializing.',
        updatedAt: new Date().toISOString()
      });

      void Promise.resolve(nativeBridge.start())
        .then(async () => {
          if (generation !== runtimeGenerationRef.current) {
            if (nativeBridge.stop) await Promise.resolve(nativeBridge.stop()).catch(() => undefined);
            nativeBridgeStartedRef.current = false;
            return;
          }
          trackingRequestActiveRef.current = false;
          setStatus('ready');
          emitStatus(
            'ready',
            source === 'arkit-native'
              ? 'ARKit visual-inertial SLAM active.'
              : 'ARCore visual-inertial SLAM active.'
          );
        })
        .catch(() => {
          nativeBridgeStartedRef.current = false;
          trackingRequestActiveRef.current = false;
          if (generation !== runtimeGenerationRef.current) return;
          setOverlayTransparent(false);
          beginFallback('Native AR tracking could not start; stabilized sensor fusion is active.');
        });
      return;
    }

    const xr = (navigator as NavigatorWithXr).xr;
    if (!xr) {
      trackingRequestActiveRef.current = false;
      beginFallback('This browser does not expose immersive WebXR SLAM; stabilized sensor fusion is active.');
      return;
    }

    // Keep requestSession synchronous with the AR activation event: immersive
    // sessions require transient user activation in supporting browsers.
    const sessionPromise = xr.requestSession(
      'immersive-ar',
      immersiveArSessionOptions(resolveOverlayRoot())
    );

    void sessionPromise
      .then(async (session) => {
        if (generation !== runtimeGenerationRef.current) {
          await session.end().catch(() => undefined);
          return;
        }

        try {
          await initializeXrSession(session, trackingSourceForWebXr(navigator.userAgent), generation);
          if (generation === runtimeGenerationRef.current) trackingRequestActiveRef.current = false;
        } catch {
          const ownsRuntime = xrSessionRef.current === session;
          if (ownsRuntime) {
            xrSessionRef.current = null;
            clearXrResources();
            setOverlayTransparent(false);
          }
          await session.end().catch(() => undefined);

          if (generation !== runtimeGenerationRef.current) return;
          trackingRequestActiveRef.current = false;
          beginFallback('Immersive WebXR SLAM initialization failed; stabilized sensor fusion is active.');
        }
      })
      .catch(() => {
        if (generation !== runtimeGenerationRef.current) return;
        trackingRequestActiveRef.current = false;
        beginFallback('Immersive WebXR SLAM could not start; stabilized sensor fusion is active.');
      });
  }, [beginFallback, clearXrResources, initializeXrSession, resolveOverlayRoot, setOverlayTransparent, stopCamera]);

  const stopTracking = useCallback(() => {
    runtimeGenerationRef.current += 1;
    explicitStopRef.current = true;
    trackingRequestActiveRef.current = false;

    const session = xrSessionRef.current;
    xrSessionRef.current = null;
    clearXrResources();
    if (session) void session.end().catch(() => undefined);

    const nativeBridge = (window as WindowWithArRuntimes).BuddiesNativeAR;
    if (nativeBridgeStartedRef.current && nativeBridge?.stop) {
      void Promise.resolve(nativeBridge.stop()).catch(() => undefined);
    }
    nativeBridgeStartedRef.current = false;

    stopCamera();
    setOverlayTransparent(false);
    useMapRuntimeStore.getState().resetArTracking();
    setStatus('idle');
  }, [clearXrResources, setOverlayTransparent, stopCamera]);

  useEffect(() => {
    const requestTracking = () => startTracking();
    const stopSpatialTracking = () => stopTracking();
    const requestFallbackCamera = () => void startFallbackCamera();
    const stopFallbackCamera = () => stopCamera();

    window.addEventListener('buddies:ar-tracking-request', requestTracking);
    window.addEventListener('buddies:ar-tracking-stop', stopSpatialTracking);
    window.addEventListener('buddies:ar-camera-request', requestFallbackCamera);
    window.addEventListener('buddies:ar-camera-stop', stopFallbackCamera);

    return () => {
      window.removeEventListener('buddies:ar-tracking-request', requestTracking);
      window.removeEventListener('buddies:ar-tracking-stop', stopSpatialTracking);
      window.removeEventListener('buddies:ar-camera-request', requestFallbackCamera);
      window.removeEventListener('buddies:ar-camera-stop', stopFallbackCamera);
      stopTracking();
    };
  }, [startFallbackCamera, startTracking, stopCamera, stopTracking]);

  useEffect(() => {
    function handleNativePose(event: Event) {
      const detail = (event as CustomEvent<NativeArPoseDetail>).detail;
      if (!detail || !nativeBridgeStartedRef.current) return;

      const state = useMapRuntimeStore.getState();
      if (state.cameraMode !== 'ar') return;
      const source = trackingSourceForNative(detail.source);

      if (typeof detail.latitude === 'number' && typeof detail.longitude === 'number') {
        state.patchArTracking({
          source,
          state: detail.trackingState ?? 'tracking',
          anchorLatitude: detail.latitude,
          anchorLongitude: detail.longitude,
          heading: typeof detail.heading === 'number' ? detail.heading : state.arTracking.heading,
          message: detail.trackingState === 'limited'
            ? 'Native SLAM tracking is temporarily limited.'
            : detail.surfaceTracked
              ? 'Native visual-inertial SLAM and surface tracking locked.'
              : 'Native visual-inertial SLAM tracking locked.',
          updatedAt: new Date().toISOString()
        });
        return;
      }

      if (detail.position && detail.orientation) {
        patchLocalPose(
          source,
          detail.position,
          detail.orientation,
          detail.trackingState ?? 'tracking',
          detail.surfaceTracked ?? false
        );
      }
    }

    window.addEventListener('buddies:native-ar-pose', handleNativePose);
    return () => window.removeEventListener('buddies:native-ar-pose', handleNativePose);
  }, [patchLocalPose]);

  useEffect(() => {
    if (cameraMode !== 'ar') {
      const state = useMapRuntimeStore.getState();
      if (xrSessionRef.current || nativeBridgeStartedRef.current || streamRef.current || state.arTracking.state !== 'idle') {
        stopTracking();
      }
    }
  }, [cameraMode, stopTracking]);

  const platformOwnsCamera = trackingSource === 'arcore-webxr'
    || trackingSource === 'webxr-slam'
    || trackingSource === 'arkit-native'
    || trackingSource === 'arcore-native';

  if (cameraMode !== 'ar') {
    return <div ref={rootLocatorRef} className="hidden" aria-hidden="true" />;
  }

  if (platformOwnsCamera) {
    return <div ref={rootLocatorRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden="true" />;
  }

  return (
    <div ref={rootLocatorRef} className="absolute inset-0 z-0 overflow-hidden bg-black" aria-label="Live rear camera AR background">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`h-full w-full object-cover transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-20'}`}
      />
      {status !== 'ready' ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/70 p-8 text-center text-white">
          <div className="max-w-sm rounded-3xl border border-white/20 bg-black/40 p-5 backdrop-blur-xl">
            <div className="text-3xl" aria-hidden="true">📷</div>
            <p className="mt-3 font-black">{status === 'requesting' ? 'Starting AR tracking…' : 'Camera AR needs access'}</p>
            <p className="mt-2 text-sm text-white/70">
              {status === 'denied'
                ? 'Camera permission is blocked. Enable camera access for this site, then tap AR again.'
                : status === 'unavailable'
                  ? 'This browser does not expose camera access. Open Buddies in Safari/Chrome over HTTPS.'
                  : 'Buddies is selecting SLAM when available and preparing the rear camera fallback.'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
