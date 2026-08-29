export type LocationRuntimeStatus = 'requesting' | 'active' | 'denied' | 'unavailable' | 'timeout' | 'error';

export type LocationRuntimeStatusDetail = {
  status: LocationRuntimeStatus;
  message: string;
  accuracyMeters?: number;
};

export const LOCATION_STATUS_EVENT = 'buddies:location-status';

export function locationErrorDetail(error: GeolocationPositionError): LocationRuntimeStatusDetail {
  if (error.code === error.PERMISSION_DENIED) {
    return {
      status: 'denied',
      message: 'Location permission is blocked for this site.'
    };
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return {
      status: 'unavailable',
      message: 'The device could not determine a GPS position.'
    };
  }

  if (error.code === error.TIMEOUT) {
    return {
      status: 'timeout',
      message: 'GPS acquisition timed out. Retrying automatically.'
    };
  }

  return {
    status: 'error',
    message: error.message || 'Location tracking failed.'
  };
}

export function publishLocationStatus(detail: LocationRuntimeStatusDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LocationRuntimeStatusDetail>(LOCATION_STATUS_EVENT, { detail }));
}
