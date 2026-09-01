import type { RecognitionCandidate } from './camera';

export type RecognitionResponse = {
  candidates: RecognitionCandidate[];
  requestId?: string;
};

export async function recognizeDogImage(image: Blob, signal?: AbortSignal): Promise<RecognitionResponse> {
  const body = new FormData();
  body.append('image', image, 'dog-frame.jpg');

  const response = await fetch('/api/doggy-recognition/identify', {
    method: 'POST',
    body,
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Recognition request failed (${response.status})`);
  }

  const payload = await response.json() as RecognitionResponse;
  return { candidates: Array.isArray(payload.candidates) ? payload.candidates : [], requestId: payload.requestId };
}
