'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

const TERRAIN_SOURCE_ID = 'buddies-terrain-dem';
const BUILDINGS_LAYER_ID = 'buddies-ar-buildings';

export default function MapArEnvironment() {
  const maps = useMap();
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);

  useEffect(() => {
    const mapRef = maps.current;
    const mapInstance = mapRef?.getMap();
    if (!mapInstance) return;
    const map = mapInstance;

    function applyEnvironment() {
      if (!map.isStyleLoaded()) return;
      const arEnabled = cameraMode === 'ar';

      try {
        if (!map.getSource(TERRAIN_SOURCE_ID)) {
          map.addSource(TERRAIN_SOURCE_ID, {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14
          });
        }

        map.setTerrain(arEnabled ? { source: TERRAIN_SOURCE_ID, exaggeration: 1.35 } : null);
      } catch (error) {
        console.warn('Buddies AR terrain unavailable', error);
      }

      try {
        map.setFog(arEnabled ? {
          range: [0.6, 12],
          color: '#dbeafe',
          'high-color': '#93c5fd',
          'space-color': '#020617',
          'horizon-blend': 0.14
        } : null);
      } catch (error) {
        console.warn('Buddies AR atmosphere unavailable', error);
      }

      try {
        if (!map.getLayer(BUILDINGS_LAYER_ID) && map.getSource('composite')) {
          const labelLayer = map.getStyle().layers?.find((layer) => (
            layer.type === 'symbol' && Boolean(layer.layout?.['text-field'])
          ));

          map.addLayer({
            id: BUILDINGS_LAYER_ID,
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            filter: ['==', ['get', 'extrude'], 'true'],
            layout: { visibility: arEnabled ? 'visible' : 'none' },
            paint: {
              'fill-extrusion-color': '#dbeafe',
              'fill-extrusion-height': ['coalesce', ['get', 'height'], 6],
              'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
              'fill-extrusion-opacity': 0.76,
              'fill-extrusion-vertical-gradient': true
            }
          }, labelLayer?.id);
        } else if (map.getLayer(BUILDINGS_LAYER_ID)) {
          map.setLayoutProperty(BUILDINGS_LAYER_ID, 'visibility', arEnabled ? 'visible' : 'none');
        }
      } catch (error) {
        console.warn('Buddies AR buildings unavailable', error);
      }
    }

    map.on('style.load', applyEnvironment);
    applyEnvironment();
    return () => {
      map.off('style.load', applyEnvironment);
    };
  }, [cameraMode, maps]);

  return null;
}
