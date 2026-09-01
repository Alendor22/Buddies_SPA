import { describe, expect, it } from 'vitest';
import {
  RecognitionStorageValidationError,
  validateRecognitionUpload
} from '@/lib/recognition/storage';

describe('recognition enrollment upload validation', () => {
  it('accepts supported image types within the 8 MiB limit', () => {
    expect(() => validateRecognitionUpload({ mimeType: 'image/jpeg', contentLength: 1024 })).not.toThrow();
    expect(() => validateRecognitionUpload({ mimeType: 'image/webp', contentLength: 8 * 1024 * 1024 })).not.toThrow();
  });

  it('rejects unsupported MIME types', () => {
    expect(() => validateRecognitionUpload({ mimeType: 'image/svg+xml', contentLength: 1024 }))
      .toThrow(RecognitionStorageValidationError);
  });

  it('rejects empty or oversized payloads', () => {
    expect(() => validateRecognitionUpload({ mimeType: 'image/png', contentLength: 0 }))
      .toThrow(RecognitionStorageValidationError);
    expect(() => validateRecognitionUpload({ mimeType: 'image/png', contentLength: 8 * 1024 * 1024 + 1 }))
      .toThrow(RecognitionStorageValidationError);
  });
});
