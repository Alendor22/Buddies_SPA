# Buddies SPA V2

Production-oriented dog identity, safety, walking, and social network.

## Stack

- Next.js 15 App Router
- React 19 + TypeScript
- Zustand session state
- Tailwind CSS
- PostgreSQL + Prisma
- Clerk authentication
- Upstash Redis
- Cloudflare R2
- Mapbox GL
- Ably realtime
- Vercel

## Dog recognition — Track 1

Dog recognition is being developed as an isolated, feature-flagged capability. Enrollment and persistence are server-authorized against Clerk-linked Buddies users and existing dog ownership. QR scanning remains the deterministic fallback.

The enrollment API and R2 upload/asset-processing boundaries are implemented on the Track 1 branch and default off via `DOG_RECOGNITION_ENROLLMENT_ENABLED=false` until validated for a test cohort.

See `docs/tracks/TRACK-1-DOG-RECOGNITION.md` for the architecture and rollout sequence.
