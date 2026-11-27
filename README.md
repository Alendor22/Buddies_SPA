# Buddies SPA V2

Buddies is a mobile-first dog identity, safety, walking, and social web application. Dog and owner profiles, QR identity, lost-dog reporting, dog discovery, maps, walks, messaging, and community activity are organized in one signed-in product.

## Product design

The application uses a Next.js App Router frontend with server-side routes and PostgreSQL-backed domain data. Prisma models and migrations define durable data; authentication, validation, and ownership checks are enforced by server routes. Map views support walk planning and nearby social activity. Public dog and QR pages are designed to expose a dog's shareable safety information.

## Implemented in the repository

These capabilities have application routes and/or UI and supporting tests in the current `main` branch. They describe checked-in functionality, not a guarantee that every optional external integration is active in production.

- **Dog identity and safety:** owner and dog profiles, QR pages/scanning, and lost-dog reporting and discovery.
- **Photo recognition:** enrollment and search flows connect to the dog-reidentification service. Image normalization/compression and uncertain-match similarity feedback are implemented. Enrollment is controlled by configuration; the recognition endpoint, token, and calibrated threshold must be configured for operation.
- **Social and walks:** buddy requests, walk invitations, map and route planning, packs, pack discovery, meetups, and social navigation. Packs and meetups can be connected to conversations; community participation supports invitations and join requests.
- **Messaging:** conversation history and message routes are persisted in application data. Realtime delivery depends on Ably configuration.
- **Account and public information:** public privacy, terms, and data-deletion pages, plus a data-deletion request status view.
- **MCP:** `/api/mcp` provides read-only, owner-scoped tools for dog profiles, walks, and unread notifications. Personal access tokens are created in account settings and can be revoked.
- **Media and temporary activity:** Cloudflare R2 media support and Upstash Redis support are present in the application.

## Planned or configuration-dependent

- Meta connections, sharing, and messaging are behind feature flags and default to off. Configure and validate them in an isolated environment before enabling.
- Dog photo enrollment/search requires the external recognition service and a calibrated match threshold. The example configuration leaves enrollment disabled and recognition endpoint values empty.
- Production readiness reports Ably as `not_configured` (see the snapshot below), so realtime delivery is not verified even though persisted messaging is implemented.
- Packs/meetups and other checked-in features should be exercised in the target deployment before relying on them for live workflows.

## Technology

- Next.js 16 App Router, React 19, TypeScript, Node.js 24+
- Tailwind CSS 4, Zustand 5, Zod 4
- PostgreSQL, Prisma 7 with the PostgreSQL adapter
- Clerk authentication
- Mapbox GL / `react-map-gl`
- Ably realtime transport (requires configuration)
- Upstash Redis
- Cloudflare R2 through the AWS S3-compatible SDK
- Dog recognition service on Fly.io
- Vercel hosting; GitHub Actions for CI, gated production deployment, smoke checks, and service deployment

## Build, release, and production status

The GitHub Actions CI workflow runs phase-contract and Prisma checks, typecheck, lint, progressive tests with coverage, a CI-safe Next.js build, PostgreSQL migration/invariant tests, and Chromium browser journeys. `npm run build:ci` intentionally avoids production database migrations. `npm run build` runs `prisma migrate deploy` before the app build.

The production workflow is configured to deploy only after successful CI; production smoke checks then validate the exact deployed commit. The Fly.io workflow deploys the recognition service when its service files change or when manually dispatched.

**Evidence snapshot (November 27, 2026):** Vercel reports the production deployment for `main` at commit `a0e0d8194e671d106c0c94f41a59f14e958139e7` as Ready. A deep readiness request to `https://www.dogbuddies.net/api/health?deep=1` returned `ready: true`, database and Redis healthy, auth and Mapbox configured, and R2 configured. Ably reported `not_configured`. The latest GitHub CI run for that commit completed with the validation and database-test jobs successful but the critical Chromium browser-journey job failed; the automated production deploy and smoke workflows were skipped. The live deployment and deep health response are evidence of current service readiness, but do not turn the failed browser gate into a passing CI result.

Production status can change after this snapshot. Before release or operational decisions, check the [latest CI runs](https://github.com/Alendor22/Buddies_SPA/actions), the Vercel deployment's source SHA, and the deep readiness endpoint. A liveness response alone does not verify database or service readiness.

## Local development

Requirements: Node.js 24 or later, npm, and PostgreSQL. Copy the example environment file and supply the values needed by the features you use. Keep real secrets out of source control.

```bash
npm ci
cp .env.example .env
npx prisma generate
npm run prisma:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a local development database, set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in `.env` to that database before applying migrations. Mapbox, Clerk, Ably, Redis, R2, and dog-recognition variables are described in [`.env.example`](./.env.example); some features can be unavailable until their services are configured. See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment variables, migration sequencing, readiness checks, release gates, and rollback instructions.

## Validation commands

```bash
npm run audit:phases
npm run typecheck
npm run lint
npm test
npm run build:ci
```

Additional suites: `npm run test:database` needs a disposable PostgreSQL database; `npm run test:e2e` needs the Playwright Chromium setup and configured test authentication. `npm run test:all` runs the full suite. `npm run check` combines phase audit, Prisma generation, typecheck, lint, fast tests, and the CI build.
