import { describe, expect, it } from 'vitest';
import { isDogRecognitionEnrollmentEnabled } from '@/lib/recognition/featureFlag';

describe('dog recognition enrollment feature flag', () => {
  it('fails closed when the flag is missing', () => {
    expect(isDogRecognitionEnrollmentEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it.each(['1', 'true', 'TRUE', 'yes', 'on'])('enables for %s', (value) => {
    expect(isDogRecognitionEnrollmentEnabled({ DOG_RECOGNITION_ENROLLMENT_ENABLED: value } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('does not enable for arbitrary truthy strings', () => {
    expect(isDogRecognitionEnrollmentEnabled({ DOG_RECOGNITION_ENROLLMENT_ENABLED: 'enabled' } as NodeJS.ProcessEnv)).toBe(false);
  });
});
