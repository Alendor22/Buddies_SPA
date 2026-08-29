# Track 1 — Dog Recognition Core

## Objective

Add visual dog recognition as an isolated, feature-flagged identity path without destabilizing the production Buddies identity/safety application.

## Context consolidated from Buddies work

- Production remains the stable baseline.
- Clerk is the authentication/workflow authority; do not reintroduce Resend as an application workflow dependency.
- Existing QR scanning remains the deterministic fallback identity path.
- Visual dog recognition is isolated from production until schema, services, enrollment, camera capture, and matching are validated in slices.
- ARKit/ARCore SLAM/XR belongs behind the scanner/camera boundary and consumes recognition output; it must not be coupled to the recognition provider.

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
        +--> XR overlay adapter (later slice)
        +--> QR fallback when confidence is insufficient
```

## Slice order

1. Contracts + provider boundary (this framework).
2. Persistence schema for enrollment assets, embeddings/model metadata, consent/state, and recognition audit records.
3. Authenticated enrollment service using Clerk user identity and verified dog ownership.
4. Recognition API/service with validation, rate limiting, observability, and confidence policy.
5. Camera integration in `/scanner`, retaining QR fallback.
6. ARKit/ARCore SLAM/XR native bridge consuming normalized recognition results.
7. Feature flag rollout, test cohort, telemetry, then production promotion.

## Security invariants

- Recognition never transfers ownership.
- A recognized dog candidate is not proof of ownership.
- Enrollment mutations require authenticated Clerk identity plus server-side authorization against the dog owner record.
- Public recognition results expose only fields already permitted by the public safety profile policy.
- Raw captures should be ephemeral by default; persistence requires an explicit enrollment/storage purpose.
- Provider credentials remain server-side.

## Core contracts

`src/lib/recognition/contracts.ts` defines the provider-neutral request/result model.

`src/lib/recognition/provider.ts` defines the replaceable provider boundary. The default implementation intentionally fails closed until a real adapter is configured.

## Next implementation slice

Create the Prisma recognition/enrollment schema and server repository layer, then wire an authenticated enrollment endpoint behind a feature flag. Do not connect camera/XR to a placeholder matcher.
