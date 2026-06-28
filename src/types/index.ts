export type Coordinates = { latitude: number; longitude: number };

export type RealtimeEvent<T = unknown> = {
  type: string;
  payload: T;
  occurredAt: string;
};
