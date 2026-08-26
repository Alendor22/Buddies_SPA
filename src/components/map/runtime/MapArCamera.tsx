'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';
import type { ArCameraStatus } from './arTypes';

function emitStatus(status: ArCameraStatus, message: string) {
  window.dispatchEvent(new CustomEvent('buddies:ar-camera-status', {
    detail: { status, message }
  }));
}

export default function MapArCamera() {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<ArCameraStatus>('idle');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      setStatus('ready');
      emitStatus('ready', 'Rear camera is live.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      emitStatus('unavailable', 'Camera access is unavailable in this browser.');
      return;
    }

    setStatus('requesting');
    emitStatus('requesting', 'Requesting rear camera access…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }

      setStatus('ready');
      emitStatus('ready', 'Rear camera is live. Spatial map overlay enabled.');
    } catch (error) {
      const denied = error instanceof DOMException
        && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      const nextStatus: ArCameraStatus = denied ? 'denied' : 'error';
      const message = denied
        ? 'Camera permission was denied. Allow camera access for Buddies and tap AR again.'
        : 'Rear camera could not be started.';
      setStatus(nextStatus);
      emitStatus(nextStatus, message);
    }
  }, []);

  useEffect(() => {
    const request = () => void startCamera();
    const stop = () => stopCamera();
    window.addEventListener('buddies:ar-camera-request', request);
    window.addEventListener('buddies:ar-camera-stop', stop);
    return () => {
      window.removeEventListener('buddies:ar-camera-request', request);
      window.removeEventListener('buddies:ar-camera-stop', stop);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    if (cameraMode !== 'ar') {
      stopCamera();
      return;
    }

    if (!streamRef.current && status === 'idle') void startCamera();
  }, [cameraMode, startCamera, status, stopCamera]);

  if (cameraMode !== 'ar') return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black" aria-label="Live rear camera AR background">
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
            <p className="mt-3 font-black">{status === 'requesting' ? 'Starting AR camera…' : 'Camera AR needs access'}</p>
            <p className="mt-2 text-sm text-white/70">
              {status === 'denied'
                ? 'Camera permission is blocked. Enable camera access for this site, then tap AR again.'
                : status === 'unavailable'
                  ? 'This browser does not expose camera access. Open Buddies in Safari/Chrome over HTTPS.'
                  : 'Buddies is preparing the rear camera for the spatial overlay.'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
