type GeocodedLocation = {
  latitude: number;
  longitude: number;
  label: string | null;
};

export async function geocodePlace(query: string): Promise<GeocodedLocation | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const normalized = query.trim();
  if (!token || !normalized) return null;

  const search = new URLSearchParams({
    q: normalized,
    access_token: token,
    limit: '1',
    country: 'US',
    language: 'en'
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${search.toString()}`, {
    cache: 'no-store'
  });
  if (!response.ok) return null;

  const payload = await response.json() as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { full_address?: string; name?: string };
    }>;
  };

  const feature = payload.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null;

  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
    label: feature?.properties?.full_address || feature?.properties?.name || null
  };
}
