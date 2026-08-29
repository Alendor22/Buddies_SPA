# Track 1 — Dog Recognition Core

## Objective
Add visual dog recognition as an isolated, feature-flagged capability without weakening Buddies identity or ownership boundaries.

## Product and security rules

- Clerk remains the authentication/workflow authority. Do not reintroduce Resend as an application workflow dependency.
- Existing QR scanning remains the deterministic fallback.
- Recognition never transfers ownership and a recognition candidate is never proof of ownership.
- Enrollment mutations require authenticated Clerk identity plus server-side dog ownership authorization.
- Raw captures are ephemeral by default; persistent enrollment storage is explicit and purpose-bound.
- Provider/model credentials remain server-side.
- Recognition providers and embedding processors fail closed until explicitly configured.

## Architecture

```text
camera / upload / XR frame
        |
        v
RecognitionRequest
        |
        v
DogRecognitionProvider  <--- provider adapter (model/vendor/local inference)
        |
        v
RecognitionResult
        |
        +--> identity candidate resolver
        +--> scanner UI
        +--> XR overlay adapter
        +--> QR fallback when confidence is insufficient
```

Enrollment path:

```text
Clerk user
   |
   v
verified Dog.ownerId
   |
   v
RecognitionEnrollment (explicit consent)
   |
   +--> presigned R2 enrollment image upload
   |       - JPEG / PNG / WebP only
   |       - actual declared Content-Length signed
   |       - 8 MiB maximum
   |       - owner/dog-scoped object prefix
   |
   +--> RecognitionAsset registration (SHA-256 hash)
           |
           v
     RecognitionAssetProcessor
           |
           +--> embeddingRef
           +--> modelVersion
           +--> qualityScore
```

## Slice status

1. Contracts + recognition provider boundary — **done**
2. Prisma enrollment/assets/audit persistence + migration — **done**
3. Ownership-checked enrollment service — **done**
4. Authenticated Clerk-backed enrollment API — **done**
5. Server-side feature flag (`DOG_RECOGNITION_ENROLLMENT_ENABLED`) — **done**
6. Bounded R2 enrollment upload signing + asset registration — **done**
7. Asset processor/embedding adapter boundary — **done**
8. Unit coverage for feature flag and upload validation — **done**
9. Camera integration in `/scanner`, retaining QR fallback — **next**
10. ARKit/ARCore SLAM/XR bridge consuming normalized recognition output — pending
11. Test cohort, telemetry, and production promotion — pending

## Current API surface

- `GET /api/recognition/enrollment?dogId=...` — owner-only enrollment state.
- `POST /api/recognition/enrollment` — begin/reactivate enrollment with explicit consent.
- `DELETE /api/recognition/enrollment` — revoke enrollment.
- `POST /api/recognition/enrollment/upload` — create owner/dog-scoped R2 upload URL.
- `POST /api/recognition/enrollment/assets` — register an uploaded asset with SHA-256 content hash.
- `PATCH /api/recognition/enrollment/assets` — invoke the configured asset processor.

## Rollout constraint

Do not connect scanner camera frames or XR tracking to a placeholder recognition provider. The feature flag defaults off. Camera/XR integration should begin only after CI for the persistence/API slice is green and a concrete recognition/embedding adapter is selected for the test cohort.
