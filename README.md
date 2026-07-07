# Buddies SPA V2

Production-oriented dog identity, safety, walking, and social network.

## Stack

- Next.js 15 App Router
- React 19 + TypeScript
- Zustand session state tree
- Tailwind CSS
- PostgreSQL + Prisma
- Upstash Redis
- Cloudflare R2
- Mapbox
- Ably WebSockets/realtime
- Zod validation

## Application modules

- Dog and owner profiles
- QR-based dog identity
- Public safety profile
- Lost-dog alerts and live last-seen events
- Dog-to-dog buddy relationships
- Walking invitations and requests
- Realtime messaging and presence
- Mapbox route planning with flag waypoints
- Map-based nearby activity
- Media upload adapter for Cloudflare R2
- Redis-backed temporary activity and rate-limit utilities

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000.

## Validation

```bash
npm run typecheck
npm run lint
npm run build:ci
```

## Phase 3 deployment

Production deploys from `main` to Vercel. GitHub Actions validates the application before the production smoke workflow waits for the exact Vercel commit and verifies readiness.

Health:

```text
https://buddies.vercel.app/api/health
https://buddies.vercel.app/api/health?deep=1
```

Manual production verification:

```bash
DEPLOYMENT_URL=https://buddies.vercel.app \
EXPECTED_COMMIT_SHA=<full-git-sha> \
npm run smoke:production
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for environment variables, release gates, migrations, health semantics, security headers, and rollback procedures.
