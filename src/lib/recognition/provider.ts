import type {
  DogRecognitionProvider,
  RecognitionRequest,
  RecognitionResult,
} from './contracts';

class UnconfiguredRecognitionProvider implements DogRecognitionProvider {
  async recognize(_input: RecognitionRequest): Promise<RecognitionResult> {
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
