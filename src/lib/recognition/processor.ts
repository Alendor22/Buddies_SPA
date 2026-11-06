import { embedEnrollmentImage } from './embeddings';

export type RecognitionAssetProcessingInput = {
  assetId: string;
  enrollmentId: string;
  dogId: string;
  storageKey: string;
  mimeType: string;
};

export type RecognitionAssetProcessingResult = {
  modelVersion: string;
  embeddingRef: string;
  qualityScore?: number;
};

export interface RecognitionAssetProcessor {
  process(input: RecognitionAssetProcessingInput): Promise<RecognitionAssetProcessingResult>;
}

class RemoteDogRecognitionAssetProcessor implements RecognitionAssetProcessor {
  async process(input: RecognitionAssetProcessingInput): Promise<RecognitionAssetProcessingResult> {
    const result = await embedEnrollmentImage(input.storageKey, input.mimeType);
    return { modelVersion: result.modelVersion, embeddingRef: JSON.stringify(result.embedding), qualityScore: 1 };
  }
}

const processor: RecognitionAssetProcessor = new RemoteDogRecognitionAssetProcessor();

export function configureRecognitionAssetProcessor(next: RecognitionAssetProcessor) {
  void next;
}

export function getRecognitionAssetProcessor() {
  return processor;
}
