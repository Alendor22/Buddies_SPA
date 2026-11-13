# Buddies SPA V2

Buddies is a mobile-first dog identity, safety, walking, and social platform. It gives each dog a durable profile and QR identity, and brings dog discovery, lost-dog workflows, walks, messaging, and nearby activity into one application.

## Product design

Buddies is built as a modular web application. PostgreSQL stores durable product data; Prisma provides database access and migrations; Redis supports short-lived activity and rate limits; Cloudflare R2 stores media; Ably carries realtime events and presence; Mapbox powers maps and route views. Client state is handled with Zustand. Authorization and validation belong on the server, while public dog and QR views expose only safety information intended for sharing.

Primary user journeys:

1. Create an account and manage owner and dog profiles.
2. Share a dog's QR identity and public-safe safety profile.
3. Enroll dog photos and search or verify a found dog using the recognition service.
4. Connect with other dogs, coordinate walks, exchange messages, and explore nearby activity.
5. Connect an authorized MCP client to read the signed-in owner's Buddies data.

## Current application capabilities

The current application includes these product areas:

- **Dog identity:** owner-managed dog profiles, QR identity, and a public-safe dog safety profile.
- **Lost and found:** lost-dog events and last-seen information, plus photo-based recognition enrollment, search, and verification. Recognition photos are normalized and compressed before upload; an uncertain search can return the closest similarity score instead of implying a confident match.
- **Social connections:** dog buddy relationships and walking invitations or requests.
- **Walks and maps:** Mapbox map and route planning with waypoint support, plus nearby activity and realtime presence.
- **Messaging:** realtime messaging backed by persisted application data.
- **Media and temporary activity:** Cloudflare R2 media integration and Redis-backed short-lived activity and rate limits.
- **Read-only MCP:** `/api/mcp` exposes owner-scoped tools for listing the owner's dogs, retrieving a dog profile, listing walks, and listing unread notifications. Personal access tokens are shown once when created and can be revoked. MCP v1 is read-only.

These are application capabilities represented on `main`; check the current UI, tests, and production health before treating any individual workflow as verified in a live deployment.

## Technology

- Next.js 16 App Router and React 19
- TypeScript and Node.js 24 or later
- Tailwind CSS 4
- PostgreSQL, Prisma 7, and the PostgreSQL adapter
- Clerk authentication
- Zustand 5 and Zod 4
- Mapbox GL and `react-map-gl`
- Ably realtime
- Upstash Redis
- Cloudflare R2 through the AWS S3-compatible SDK
- Dog-recognition service deployed to Fly.io
- Vercel production hosting and GitHub Actions CI

## Build and release status

The default branch is `main`. The repository defines CI checks for phase contracts, type checking, linting, tests, and a CI-safe Next.js production build. Database tests and Chromium browser journeys are available as separate validation steps. Production deployment targets Vercel; the recognition-service workflow deploys that service to Fly.io when its configured conditions are met.

The latest repository change reviewed for this README is `8e12908` (November 13, 2026), which hardens map and cleanup API usage. Recent merged work also covers recognition cold starts, camera-roll uploads and image normalization, no-match similarity reporting, Fly.io deployment automation, and the read-only MCP server.

This section describes the checked-in release process; it does not assert that the latest commit is currently deployed or that production is healthy. Confirm the intended commit and readiness endpoint before making that claim.

## Local development

Requirements: Node.js 24 or later, PostgreSQL, and the environment variables required by the features you run. Start with the example environment file and keep real secrets out of source control.

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Apply existing migrations to a development database with:

```bash
npm run prisma:deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for required environment variables, production migrations, readiness checks, release gates, and rollback steps.

## Validation

Common checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build:ci
```

Run the full validation suite with `npm run test:all` when the required disposable PostgreSQL database and Playwright browser setup are available. `npm run check` runs the phase audit, Prisma generation, type checking, lint, fast tests, and CI build. The production `npm run build` also applies Prisma migrations, so use it only in an environment configured for that release behavior.

Useful production checks:

```text
https://buddies.vercel.app/api/health
https://buddies.vercel.app/api/health?deep=1
```

A successful liveness response alone does not establish database or service readiness. For release verification, compare the deployed commit SHA with the intended commit and inspect the deep-readiness response.

## Keeping this README current

Review this README every two weeks against changes merged to `main`. Update the build snapshot, implemented capabilities, architecture, and setup or deployment guidance only when supported by current source, tests, workflow results, or deployment evidence. Label planned or unverified functionality clearly; do not infer production health from a successful code build. Keep the update focused and record it as a small documentation commit.
