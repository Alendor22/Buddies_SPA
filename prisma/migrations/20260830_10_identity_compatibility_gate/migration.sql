-- Phase 1 compatibility gate.
-- This migration is intentionally non-destructive. Legacy Dog columns remain available
-- until production dual-read/dual-write telemetry proves the new identity models are safe.

COMMENT ON COLUMN "Dog"."photoUrl" IS 'DEPRECATED after Phase 1 DogMedia cutover; retain during compatibility window';
COMMENT ON COLUMN "Dog"."medicalNotes" IS 'DEPRECATED after Phase 1 DogMedicalProfile cutover; retain during compatibility window';
COMMENT ON COLUMN "Dog"."vaccinationNotes" IS 'DEPRECATED after Phase 1 Vaccination cutover; retain during compatibility window';
COMMENT ON COLUMN "Dog"."emergencyContact" IS 'DEPRECATED after Phase 1 DogEmergencyContact cutover; retain during compatibility window';
COMMENT ON COLUMN "Dog"."publicId" IS 'LEGACY identifier retained while DogIdentifier becomes canonical';
COMMENT ON COLUMN "Dog"."ownerId" IS 'Canonical owner retained while DogCustodian adds multi-custodian access';
