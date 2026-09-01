import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('recognition consolidation contract', () => {
  it('keeps recognition persistence in the canonical Prisma schema', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toContain('enum RecognitionEnrollmentStatus');
    expect(schema).toContain('model RecognitionEnrollment');
    expect(schema).toContain('model RecognitionAsset');
    expect(schema).toContain('model RecognitionEvent');
    expect(schema).toContain('@relation("RecognitionEnrollmentDog"');
    expect(schema).toContain('@relation("RecognitionEnrollmentOwner"');
    expect(schema).toContain('@relation("RecognitionMatchedDog"');
  });

  it('uses an additive migration with relational integrity', () => {
    const migration = read('prisma/migrations/20260901_01_recognition_enrollment/migration.sql');
    expect(migration).toContain('CREATE TABLE "RecognitionEnrollment"');
    expect(migration).toContain('CREATE TABLE "RecognitionAsset"');
    expect(migration).toContain('CREATE TABLE "RecognitionEvent"');
    expect(migration).toContain('RecognitionEnrollment_dogId_fkey');
    expect(migration).toContain('RecognitionEnrollment_ownerId_fkey');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  it('keeps enrollment disabled by default and QR as the production scanner', () => {
    const env = read('.env.example');
    const scanner = read('src/app/scanner/page.tsx');
    expect(env).toContain('DOG_RECOGNITION_ENROLLMENT_ENABLED="false"');
    expect(scanner).not.toContain('DogRecognitionCamera');
  });

  it('retains normalized confidence and controlled camera sampling', () => {
    const camera = read('src/lib/doggy-recognition/camera.ts');
    expect(camera).toContain('IDENTIFY_THRESHOLD = 0.92');
    expect(camera).toContain('CONFIRM_THRESHOLD = 0.72');
    expect(camera).toContain('candidate.confidence <= 1');
    expect(camera).toContain('!input.busy');
    expect(camera).toContain('input.documentVisible');
  });

  it('requires re-consent after revocation and revokes enrollment on ownership transfer', () => {
    const service = read('src/lib/recognition/service.ts');
    const claim = read('src/app/api/dogs/claim/route.ts');
    expect(service).toContain("enrollment.status === 'REVOKED'");
    expect(service).toContain("asset.status === 'READY' && asset.modelVersion === input.modelVersion");
    expect(claim).toContain('prisma.$transaction');
    expect(claim).toContain("status: 'REVOKED'");
    expect(claim).toContain('ownerId: user.id');
  });
});
