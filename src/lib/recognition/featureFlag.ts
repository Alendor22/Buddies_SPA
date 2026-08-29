const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

type RecognitionFeatureEnvironment = {
  DOG_RECOGNITION_ENROLLMENT_ENABLED?: string;
};

export function isDogRecognitionEnrollmentEnabled(
  env: RecognitionFeatureEnvironment = process.env
) {
  return ENABLED_VALUES.has((env.DOG_RECOGNITION_ENROLLMENT_ENABLED ?? '').trim().toLowerCase());
}

export function requireDogRecognitionEnrollmentEnabled(
  env: RecognitionFeatureEnvironment = process.env
) {
  if (!isDogRecognitionEnrollmentEnabled(env)) {
    throw new Error('Dog recognition enrollment is disabled');
  }
}
