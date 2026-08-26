'use client';

import { Layer, Marker, Source } from 'react-map-gl/mapbox';

export type DeviceLoc = {
  lat: number;
  lng: number;
  accuracyMeters?: number | null;
  speedMph?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: string;
};

export type ActiveDogMapItem = {
  id: string;
  dogId?: string;
  dogName: string;
  dogSlug?: string;
  breed: string | null;
  status: string;
  walkingScore: number;
  isBuddy: boolean;
  avatar?: string;
  device_loc: DeviceLoc;
};

export type HeatCellMapItem = {
  key: string;
  latitude: number;
  longitude: number;
  activeDogs: number;
  buddies: number;
  weight?: number;
};

export type ReportMapItem = {
  id: string;
  title: string;
  type: string;
  latitude: number;
  longitude: number;
};

type Props = {
  activeDogs: ActiveDogMapItem[];
  heatCells: HeatCellMapItem[];
  reports: ReportMapItem[];
  showRadar?: boolean;
  showHeat?: boolean;
  showReports?: boolean;
};

export default function LiveMapLayers({ activeDogs, heatCells, reports, showRadar = true, showHeat = true, showReports = true }: Props) {
  const heatGeoJson = {
    type: 'FeatureCollection' as const,
    features: heatCells.map((cell) => ({
      type: 'Feature' as const,
      properties: {
        weight: Math.max(0.05, Math.min(1, cell.weight ?? Math.min(1, cell.activeDogs / 8))),
        activeDogs: cell.activeDogs,
        buddies: cell.buddies
      },
      geometry: { type: 'Point' as const, coordinates: [cell.longitude, cell.latitude] }
    }))
  };

  return (
    <>
      {showHeat && heatCells.length ? (
        <Source id="device-loc-heat" type="geojson" data={heatGeoJson}>
          <Layer
            id="device-loc-heat-layer"
            type="heatmap"
            maxzoom={18}
            paint={{
              'heatmap-weight': ['get', 'weight'],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 16, 2.2],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 16, 42],
              'heatmap-opacity': 0.72
            }}
          />
        </Source>
      ) : null}

      {showReports ? reports.map((report) => (
        <Marker key={report.id} latitude={report.latitude} longitude={report.longitude} anchor="bottom">
          <button type="button" title={`${report.title} · ${report.type}`} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-amber-500/90 text-sm shadow-lg backdrop-blur">!</button>
        </Marker>
      )) : null}

      {showRadar ? activeDogs.map((dog) => (
        <Marker key={dog.id} latitude={dog.device_loc.lat} longitude={dog.device_loc.lng} anchor="bottom">
          <button
            type="button"
            title={`${dog.dogName} · ${dog.status} · score ${dog.walkingScore}`}
            className={`grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-white/90 text-xs font-bold text-slate-900 shadow-xl backdrop-blur ${dog.isBuddy ? 'ring-4 ring-cyan-200 shadow-[0_0_24px_rgba(125,211,252,.95)]' : ''}`}
          >
            {dog.avatar || dog.dogName.slice(0, 2).toUpperCase()}
          </button>
        </Marker>
      )) : null}
    </>
  );
}
