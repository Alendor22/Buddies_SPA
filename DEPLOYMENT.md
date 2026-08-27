# Phase 3 Deployment Operations

Buddies deploys from the private GitHub repository's `main` branch to Vercel production.

## Release path

1. Push or merge code into `main`.
2. GitHub Actions runs the `CI` workflow:
   - installs dependencies on Node 24;
   - validates and generates the Prisma client;
   - typechecks and lints;
   - runs unit, component, route-integration, contract, and coverage gates;
   - applies migrations to a disposable PostgreSQL database and tests database invariants;
   - builds the production application and runs critical Chromium journeys;
   - creates a Next.js production build without changing the database.
3. Vercel builds the same commit and runs the configured production build command.
4. After CI succeeds, `Production Smoke` waits for Vercel to expose the exact commit SHA.
5. Smoke checks verify database readiness, Mapbox configuration, the public application, login page, health endpoint, and Mapbox configuration endpoint.

## Health endpoints

### Liveness

```text
GET https://buddies.vercel.app/api/health
```

This confirms that the application process can answer requests. It does not query PostgreSQL.

### Readiness

```text
GET https://buddies.vercel.app/api/health?deep=1
```

This performs bounded PostgreSQL and Redis checks and reports safe configuration status for authentication, Mapbox, Ably, and Cloudflare R2. Secrets and full connection strings are never returned.

A deployment is production-ready when:

- `ready` is `true`;
- `checks.database.status` is `healthy`;
- `checks.auth.status` is `configured`;
- `checks.mapbox.status` is `configured` for map features;
- `deployment.commitSha` matches the commit intended for release.

## Required Vercel production variables

Core:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
AUTH_SECRET
NEXT_PUBLIC_APP_URL
```

Maps:

```text
NEXT_PUBLIC_MAPBOX_TOKEN
```

The browser Mapbox token must be a public token beginning with `pk.`. The application also recognizes `MAPBOX_ACCESS_TOKEN`, `MAPBOX_PUBLIC_TOKEN`, and `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, but `NEXT_PUBLIC_MAPBOX_TOKEN` is the canonical production key.

Realtime:

```text
ABLY_API_KEY
NEXT_PUBLIC_ABLY_KEY
```

Temporary activity:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Media:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

Apply production variables to the Vercel **Production** environment and redeploy after any change.

## Database migrations

Production migrations remain explicit Prisma migrations under `prisma/migrations`.

```bash
npm run prisma:deploy
```

The CI build deliberately uses `npm run build:ci`, which does not modify a database. The Vercel production build currently uses `npm run build`, which runs `prisma migrate deploy` before the Next.js build. Do not use `prisma db push` as a production release mechanism.

## Manual smoke test

```bash
DEPLOYMENT_URL=https://buddies.vercel.app \
EXPECTED_COMMIT_SHA=<full-git-sha> \
npm run smoke:production
```

The script waits for the intended Vercel commit, performs deep readiness checks, and verifies public routes.

## Rollback

1. In Vercel, open **Deployments**.
2. Select the last known-good production deployment.
3. Choose **Promote to Production**.
4. Open `/api/health?deep=1` and verify readiness.
5. Revert the defective commit on `main` so the repository and production deployment converge.

Database migrations must be backward-compatible with the preceding application release. Destructive migrations require a separate expand/migrate/contract release sequence.

## Security baseline

The Next.js deployment applies:

- HTTPS strict transport security;
- clickjacking protection;
- MIME-sniffing protection;
- restrictive referrer behavior;
- geolocation limited to the application origin;
- camera, microphone, and payment APIs disabled by default;
- the framework identification response header disabled.
