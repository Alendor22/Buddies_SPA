'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapRuntimeStore, type MapCameraMode } from '@/stores/useMapRuntimeStore';

export default function MapCameraController() {
  const maps = useMap();
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const followZoom = useMapRuntimeStore((state) => state.followZoom);
  const followPitch = useMapRuntimeStore((state) => state.followPitch);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const telemetry = useMapRuntimeStore((state) => state.telemetry);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);

  useEffect(() => {
    function handleMode(event: Event) {
      const nextMode = (event as CustomEvent<MapCameraMode>).detail;
      if (nextMode) setCameraMode(nextMode);
    }

    window.addEventListener('buddies:map-camera-mode', handleMode);
    return () => window.removeEventListener('buddies:map-camera-mode', handleMode);
  }, [setCameraMode]);

  useEffect(() => {
    const map = maps.current;
    if (!map || telemetry.latitude == null || telemetry.longitude == null) return;

    if (cameraMode === 'follow' || cameraMode === 'ar') {
      map.easeTo({
        center: [telemetry.longitude, telemetry.latitude],
        zoom: followZoom,
        pitch: cameraMode === 'ar' ? Math.max(72, followPitch) : followPitch,
        bearing: telemetry.heading ?? bearing,
        offset: [0, 130],
        duration: 500,
        essential: true
      });
      return;
    }

    if (cameraMode === 'overview') {
      map.easeTo({
        center: [telemetry.longitude, telemetry.latitude],
        zoom: 14.5,
        pitch: 30,
        bearing: 0,
        offset: [0, 0],
        duration: 650,
        essential: true
      });
    }
  }, [bearing, cameraMode, followPitch, followZoom, maps, telemetry.heading, telemetry.latitude, telemetry.longitude]);

  return null;
}
