/** Avoid using the browser Mapbox fallback to bypass auth or server-side throttling. */
export function shouldFallbackToDirectMapbox(status: number) {
  return status !== 401 && status !== 429;
}
