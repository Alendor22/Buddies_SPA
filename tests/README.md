# Buddies progressive test harness

This package surrounds the application with tests at several speeds. It is intentionally incremental: new product areas must be added to the manifest, while coverage thresholds and API states can only become stricter over time.

## Test layers

| Layer | Purpose | External services |
| --- | --- | --- |
| Unit | Pure auth, validation, telemetry, geometry, state, and domain rules | None |
| Component | Explicit client-component behavior in jsdom | Mocked |
| Integration | Next route contracts, authorization, validation, and transaction orchestration | Mocked adapters and Prisma surface |
| Database | Migrated PostgreSQL constraints, triggers, cascades, and future concurrency tests | Dedicated test PostgreSQL |
| Contracts | Complete route inventory, access policy, capability mapping, and security backlog | Filesystem only |
| E2E | Cookies, redirects, Server Components, Server Actions, and critical user journeys | Local built app and test PostgreSQL |

## Commands

- npm test and npm run test:fast run unit, component, integration, and contract tests once.
- npm run test:watch starts the fast suite in watch mode.
- npm run test:unit, test:component, test:integration, and test:contracts select one layer.
- npm run test:coverage writes text, HTML, JSON, and LCOV reports.
- npm run test:database runs guarded, serial PostgreSQL tests.
- npm run test:e2e runs the Chromium critical journeys.
- npm run test:routes discovers every App Router page and verifies that it resolves to a final HTTP 200 state. Redirects are followed, and dynamic route parameters come from the manifest.
- npm run test:all runs every layer when a test database and browser are available.
- npm run test:audit prints current suite and API-policy progress.

## Database safety

Database tests require TEST_DATABASE_URL; they never fall back to DATABASE_URL. The database name must contain test as a separate underscore- or hyphen-delimited term. Use .env.test.example as a template.

Apply migrations with prisma migrate deploy. Do not use the production seed or prisma migrate reset: the production seed deletes application records, and the test harness must never infer permission to reset a database.

## Adding a feature

1. Add or update its capability mapping in tests/test-suite.manifest.json.
2. Classify every new API route as public, authenticated, service-secret, development-only, mixed, or review-required.
3. Add a `routeState200.dynamicParameters` fixture when a new page introduces a dynamic parameter name.
4. Start with a focused unit or route test.
5. Add a database test for behavior that depends on PostgreSQL constraints or concurrency.
6. Add Playwright coverage when cookies, redirects, async Server Components, Server Actions, or multiple users are part of the truth.
7. Move the API entry from backlog to covered only when its authorization, validation, success, and important failure paths are asserted.
8. Raise coverage thresholds after the baseline improves; never lower them to make a change pass.

## Determinism rules

- Mock Redis, R2, Mapbox, Ably, email, camera, geolocation, and time in pull-request tests.
- Use unique fixture identifiers and relative dates.
- Keep database files serial unless each worker receives its own database.
- Test realtime persistence separately from live third-party delivery.
- Reserve live Mapbox, Ably, and physical-device AR checks for tagged staging or scheduled suites.

The known security-policy gaps are represented as test.todo contracts. They are visible in every run without encoding unsafe current behavior as the desired result.
