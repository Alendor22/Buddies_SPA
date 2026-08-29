const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isDogRecognitionEnrollmentEnabled(env = process.env) {
  return ENABLED_VALUES.has((env.DOG_RECOGNITION_ENROLLMENT_ENABLED ?? '').trim().toLowerCase());
}

export function requireDogRecognitionEnrollmentEnabled(env = process.env) {
  if (!isDogRecognitionEnrollmentEnabled(env)) {
    throw new Error('Dog recognition enrollment is disabled');
  }
}
