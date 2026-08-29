import type {
  DogRecognitionProvider,
  RecognitionRequest,
  RecognitionResult,
} from './contracts';

class UnconfiguredRecognitionProvider implements DogRecognitionProvider {
  async recognize(input: RecognitionRequest): Promise<RecognitionResult> {
    void input;
    throw new Error('Dog recognition provider is not configured');
  }
}

let provider: DogRecognitionProvider = new UnconfiguredRecognitionProvider();

export function configureDogRecognitionProvider(next: DogRecognitionProvider) {
  provider = next;
}

export function getDogRecognitionProvider(): DogRecognitionProvider {
  return provider;
}
