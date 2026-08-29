import { describe, expect, it } from 'vitest';
import {
  CAMERA_SAMPLE_INTERVAL_MS,
  cameraErrorStatus,
  decideRecognition,
  recognitionStatus,
  shouldSampleFrame,
} from '@/lib/doggy-recognition/camera';

const buddy = (confidence: number) => ({ dogId: 'dog_buddy', slug: 'buddy', confidence });

describe('doggy recognition confidence policy', () => {
  it('automatically identifies only a high-confidence visual match', () => {
    expect(decideRecognition([buddy(0.97)])).toEqual({ kind: 'identified', candidate: buddy(0.97) });
  });

  it('requires human confirmation for an ambiguous but useful match', () => {
    expect(decideRecognition([buddy(0.84)])).toEqual({ kind: 'confirm', candidate: buddy(0.84) });
  });

  it('keeps low-confidence dogs unidentified instead of forcing a match', () => {
    expect(decideRecognition([buddy(0.48)]).kind).toBe('unknown');
  });

  it('selects the strongest candidate independent of backend ordering', () => {
    const result = decideRecognition([
      { dogId: 'dog_other', slug: 'other', confidence: 0.74 },
      buddy(0.96),
      { dogId: 'dog_third', slug: 'third', confidence: 0.81 },
    ]);
    expect(result).toEqual({ kind: 'identified', candidate: buddy(0.96) });
  });

  it('does not allow malformed confidence values to become identities', () => {
    expect(decideRecognition([{ dogId: 'bad', slug: 'bad', confidence: Number.NaN }])).toEqual({ kind: 'unknown', candidate: undefined });
  });

  it('maps recognition decisions directly to responsive camera UI states', () => {
    expect(recognitionStatus(decideRecognition([buddy(0.95)]))).toBe('identified');
    expect(recognitionStatus(decideRecognition([buddy(0.80)]))).toBe('confirm');
    expect(recognitionStatus(decideRecognition([]))).toBe('unknown');
  });
});

describe('doggy recognition live-camera sampling', () => {
  const ready = {
    now: 1_000,
    lastSampleAt: 1_000 - CAMERA_SAMPLE_INTERVAL_MS,
    busy: false,
    videoReady: true,
    documentVisible: true,
  };

  it('samples immediately when the interval has elapsed', () => {
    expect(shouldSampleFrame(ready)).toBe(true);
  });

  it('never overlaps recognition requests', () => {
    expect(shouldSampleFrame({ ...ready, busy: true })).toBe(false);
  });

  it('does not waste inference before the video has a usable frame', () => {
    expect(shouldSampleFrame({ ...ready, videoReady: false })).toBe(false);
  });

  it('pauses inference when the browser tab is hidden', () => {
    expect(shouldSampleFrame({ ...ready, documentVisible: false })).toBe(false);
  });

  it('throttles frames to keep the camera responsive', () => {
    expect(shouldSampleFrame({ ...ready, lastSampleAt: 900 })).toBe(false);
  });
});

describe('doggy recognition camera failures', () => {
  it('surfaces camera permission denial as a recoverable state', () => {
    expect(cameraErrorStatus(new DOMException('blocked', 'NotAllowedError'))).toBe('denied');
  });

  it('keeps unexpected camera failures distinct from permission denial', () => {
    expect(cameraErrorStatus(new Error('camera disconnected'))).toBe('error');
  });
});
