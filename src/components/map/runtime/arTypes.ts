export type ArCameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error';

export type ArCameraStatusDetail = {
  status: ArCameraStatus;
  message: string;
};
