export const socialMapRealtimeEvents = {
  presenceUpdated: 'presence.updated',
  presenceLeft: 'presence.left',
  reportCreated: 'report.created'
} as const;

export type SocialMapPresenceItem = {
  id: string;
  dogId: string;
  dogName: string;
  dogSlug: string;
  breed: string | null;
  avatar: string;
  status: string;
  walkingScore: number;
  neighborhoodKey: string;
  device_loc: {
    lat: number;
    lng: number;
    accuracyMeters: number | null;
    speedMph: number | null;
    heading: number | null;
    timestamp: string;
  };
};

export type SocialMapPresenceUpdatedEvent = {
  neighborhoodKey: string;
  presence: SocialMapPresenceItem;
};

export type SocialMapPresenceLeftEvent = {
  neighborhoodKey: string;
  dogId: string;
  presenceId: string;
};

export type SocialMapReportCreatedEvent = {
  neighborhoodKey: string;
  report: {
    id: string;
    title: string;
    type: string;
    latitude: number;
    longitude: number;
  };
};
