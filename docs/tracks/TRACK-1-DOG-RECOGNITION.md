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
9. Eight-view owner enrollment (front L/C/R, rear L/C/R, left/right head-on) — **planned**
10. QR-targeted 1:1 verification against enrolled embeddings — **planned**
11. ARKit/ARCore SLAM/XR bridge consuming normalized recognition output — pending
12. Test cohort, telemetry, and production promotion — pending

## Current API surface

- `GET /api/recognition/enrollment?dogId=...` — owner-only enrollment state.
- `POST /api/recognition/enrollment` — begin/reactivate enrollment with explicit consent.
- `DELETE /api/recognition/enrollment` — revoke enrollment.
- `POST /api/recognition/enrollment/upload` — create owner/dog-scoped R2 upload URL.
- `POST /api/recognition/enrollment/assets` — register an uploaded asset with SHA-256 content hash.
- `PATCH /api/recognition/enrollment/assets` — invoke the configured asset processor.

## Rollout constraint

Do not connect scanner camera frames or XR tracking to an unconfigured recognition service. The feature flag defaults off. The planned whole-body integration uses an eight-view enrollment, stores provider-generated embeddings in the existing recognition assets, and uses a QR public ID to select the dog for 1:1 verification. Match thresholds must be calibrated against labeled same-dog and different-dog samples before results are treated as reliable.
