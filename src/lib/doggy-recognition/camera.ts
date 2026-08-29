export type RecognitionCandidate = {
  dogId: string;
  slug: string;
  confidence: number;
};

export type RecognitionDecision =
  | { kind: 'identified'; candidate: RecognitionCandidate }
  | { kind: 'confirm'; candidate: RecognitionCandidate }
  | { kind: 'unknown'; candidate?: RecognitionCandidate };

export type CameraRecognitionStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'processing'
  | 'identified'
  | 'confirm'
  | 'unknown'
  | 'denied'
  | 'unsupported'
  | 'error';

export const CAMERA_SAMPLE_INTERVAL_MS = 220;
export const IDENTIFY_THRESHOLD = 0.92;
export const CONFIRM_THRESHOLD = 0.72;

export function decideRecognition(
  candidates: RecognitionCandidate[],
  identifyThreshold = IDENTIFY_THRESHOLD,
  confirmThreshold = CONFIRM_THRESHOLD,
): RecognitionDecision {
  const best = [...candidates]
    .filter((candidate) => Number.isFinite(candidate.confidence))
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!best || best.confidence < confirmThreshold) return { kind: 'unknown', candidate: best };
  if (best.confidence >= identifyThreshold) return { kind: 'identified', candidate: best };
  return { kind: 'confirm', candidate: best };
}

export function shouldSampleFrame(input: {
  now: number;
  lastSampleAt: number;
  busy: boolean;
  videoReady: boolean;
  documentVisible: boolean;
  intervalMs?: number;
}) {
  const interval = input.intervalMs ?? CAMERA_SAMPLE_INTERVAL_MS;
  return input.videoReady
    && input.documentVisible
    && !input.busy
    && input.now - input.lastSampleAt >= interval;
}

export function cameraErrorStatus(error: unknown): CameraRecognitionStatus {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return 'denied';
  }
  return 'error';
}

export function recognitionStatus(decision: RecognitionDecision): CameraRecognitionStatus {
  return decision.kind;
}
