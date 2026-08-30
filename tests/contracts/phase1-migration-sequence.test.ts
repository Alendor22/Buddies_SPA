import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = (name: string) =>
  readFileSync(`${root}/prisma/migrations/${name}/migration.sql`, 'utf8');

const sequence = [
  '20260830_01_user_preferences_households_custodians',
  '20260830_03_dog_media',
  '20260830_04_dog_medical_profile',
  '20260830_05_vaccinations',
  '20260830_06_dog_identifiers',
  '20260830_07_emergency_contacts',
  '20260830_08_consent_audit',
  '20260830_09_dog_share_grants',
  '20260830_10_identity_compatibility_gate',
];

describe('Phase 1 Prisma migration sequence', () => {
  it('keeps the rollout additive and preserves legacy Dog fields', () => {
    const sql = sequence.map(migration).join('\n');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"Dog"[\s\S]*DROP/i);
  });

  it('creates every Phase 1 identity model', () => {
    const sql = sequence.map(migration).join('\n');
    for (const table of [
      'UserPreference',
      'Household',
      'HouseholdMember',
      'DogCustodian',
      'DogMedia',
      'DogMedicalProfile',
      'Vaccination',
      'DogIdentifier',
      'DogEmergencyContact',
      'ConsentGrant',
      'AuditEvent',
      'DogShareGrant',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it('contains compatibility backfills for legacy identity fields', () => {
    expect(migration('20260830_03_dog_media')).toContain('d."photoUrl"');
    expect(migration('20260830_04_dog_medical_profile')).toContain('d."medicalNotes"');
    expect(migration('20260830_05_vaccinations')).toContain('d."vaccinationNotes"');
    expect(migration('20260830_06_dog_identifiers')).toContain('d."publicId"');
    expect(migration('20260830_07_emergency_contacts')).toContain('d."emergencyContact"');
  });

  it('does not fabricate consent during migration', () => {
    const sql = migration('20260830_08_consent_audit');
    expect(sql).toContain('Intentionally no consent backfill');
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"ConsentGrant"/i);
  });

  it('ends with a non-destructive compatibility gate', () => {
    const sql = migration('20260830_10_identity_compatibility_gate');
    expect(sql).toContain('intentionally non-destructive');
    expect(sql).toContain('COMMENT ON COLUMN "Dog"."ownerId"');
  });
});
