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

class UnconfiguredRecognitionAssetProcessor implements RecognitionAssetProcessor {
  async process(input: RecognitionAssetProcessingInput): Promise<RecognitionAssetProcessingResult> {
    void input;
    throw new Error('Recognition asset processor is not configured');
  }
}

let processor: RecognitionAssetProcessor = new UnconfiguredRecognitionAssetProcessor();

export function configureRecognitionAssetProcessor(next: RecognitionAssetProcessor) {
  processor = next;
}

export function getRecognitionAssetProcessor() {
  return processor;
}
