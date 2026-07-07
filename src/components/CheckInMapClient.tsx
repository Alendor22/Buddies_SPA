'use client';

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';

type CheckInPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type Props = {
  token: string;
  centerLatitude: number;
  centerLongitude: number;
  points: CheckInPoint[];
};

export default function CheckInMapClient({ token, centerLatitude, centerLongitude, points }: Props) {
  if (!token) {
    return <div className="flex h-[420px] items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-600">Mapbox token unavailable.</div>;
  }

  return (
    <div className="h-[420px] overflow-hidden rounded-2xl border bg-slate-100 shadow-sm">
      <Map
        mapboxAccessToken={token}
        initialViewState={{ latitude: centerLatitude, longitude: centerLongitude, zoom: 12.5 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        dragRotate={false}
        touchPitch={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {points.map((point) => (
          <Marker key={point.id} latitude={point.latitude} longitude={point.longitude} anchor="bottom">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-xl text-white shadow-lg" title={point.name}>🐶</div>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
