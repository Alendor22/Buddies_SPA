import type { MotionClass } from '@/stores/useMapRuntimeStore';

export type MotionSample = {
  speedMph: number | null;
  accuracyMeters: number | null;
  displacementMeters: number;
  windowSeconds: number;
  priorClass?: MotionClass;
};

export type MotionClassification = {
  motionClass: MotionClass;
  confidence: number;
  shouldStartWalk: boolean;
  shouldPauseWalk: boolean;
  shouldStopWalk: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function classifyMotion(sample: MotionSample): MotionClassification {
  const speed = Math.max(0, sample.speedMph ?? 0);
  const accuracy = Math.max(0, sample.accuracyMeters ?? 999);
  const windowSeconds = Math.max(1, sample.windowSeconds);
  const displacement = Math.max(0, sample.displacementMeters);
  const priorWasWalking = sample.priorClass === 'walking' || sample.priorClass === 'jogging' || sample.priorClass === 'likely-walking';

  if (accuracy > 100) {
    return {
      motionClass: priorWasWalking ? 'paused' : 'stationary',
      confidence: 0.2,
      shouldStartWalk: false,
      shouldPauseWalk: priorWasWalking,
      shouldStopWalk: false
    };
  }

  if (speed >= 8 || (speed >= 6 && displacement >= 120 && windowSeconds <= 45)) {
    return {
      motionClass: 'possibly-driving',
      confidence: clamp01(0.72 + Math.min(0.25, (speed - 6) / 20)),
      shouldStartWalk: false,
      shouldPauseWalk: false,
      shouldStopWalk: priorWasWalking
    };
  }

  if (speed >= 4.5 && speed < 8 && displacement >= 25) {
    return {
      motionClass: 'jogging',
      confidence: clamp01(0.68 + Math.min(0.25, displacement / 500)),
      shouldStartWalk: windowSeconds >= 15,
      shouldPauseWalk: false,
      shouldStopWalk: false
    };
  }

  if (speed >= 0.7 && speed < 4.5 && displacement >= 20) {
    const durationFactor = Math.min(0.2, windowSeconds / 150);
    const displacementFactor = Math.min(0.2, displacement / 250);
    const confidence = clamp01(0.58 + durationFactor + displacementFactor);
    return {
      motionClass: confidence >= 0.78 ? 'walking' : 'likely-walking',
      confidence,
      shouldStartWalk: confidence >= 0.78 && windowSeconds >= 20,
      shouldPauseWalk: false,
      shouldStopWalk: false
    };
  }

  if (priorWasWalking && speed < 0.6 && displacement < 18) {
    return {
      motionClass: 'paused',
      confidence: clamp01(0.65 + Math.min(0.25, windowSeconds / 180)),
      shouldStartWalk: false,
      shouldPauseWalk: true,
      shouldStopWalk: windowSeconds >= 300
    };
  }

  return {
    motionClass: displacement >= 12 ? 'likely-walking' : 'stationary',
    confidence: displacement >= 12 ? 0.45 : 0.82,
    shouldStartWalk: false,
    shouldPauseWalk: false,
    shouldStopWalk: false
  };
}
