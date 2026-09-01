export type RecognitionSource = 'camera' | 'upload' | 'qr-fallback';

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DogCandidate = {
  dogId: string;
  slug: string;
  displayName: string;
  confidence: number;
};

export type RecognitionRequest = {
  source: RecognitionSource;
  imageRef: string;
  sessionId?: string;
};

export type RecognitionResult = {
  requestId: string;
  candidates: DogCandidate[];
  detectedDog?: BoundingBox;
  modelVersion: string;
  createdAt: string;
};

export interface DogRecognitionProvider {
  recognize(input: RecognitionRequest): Promise<RecognitionResult>;
}
