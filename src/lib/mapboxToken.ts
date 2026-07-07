function cleanEnvironmentValue(value: string | undefined) {
  if (!value) return '';

  let cleaned = value.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.slice(7).trim();
  }
  return cleaned;
}

export function getMapboxToken() {
  return cleanEnvironmentValue(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      || process.env.MAPBOX_ACCESS_TOKEN
      || process.env.MAPBOX_PUBLIC_TOKEN
      || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  );
}

export function getPublicMapboxToken() {
  const token = getMapboxToken();
  return token.startsWith('pk.') ? token : '';
}
