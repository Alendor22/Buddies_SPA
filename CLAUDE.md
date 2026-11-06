# CLAUDE.md — Buddies SPA V2

> Primary AI engineering context for `Alendor22/Buddies_SPA`.
> This file consolidates project intent, architecture, historical decisions, requested features, prior failures, deployment constraints, and working conventions from the project's ChatGPT development history.
>
> **Rule:** Treat the repository source code and current production health as authoritative when they conflict with historical notes in this file.

## 1. Project identity

**Project:** Buddies SPA V2  
**Repository:** `Alendor22/Buddies_SPA`  
**Default branch:** `main`  
**Production:** `https://buddies.vercel.app`  
**Local WSL path:** `/home/motoscucci/coding/Buddies_SPA`

Buddies is a production-oriented dog identity, safety, walking, and social-network application.

Core product concept:

- Give each dog a persistent identity/profile.
- Support owner-managed dog profiles.
- Provide QR-based identification and public safety information.
- Connect dogs and owners socially through buddy relationships.
- Coordinate walks and nearby activity.
- Support messaging, presence, routing, and map-based discovery.
- Provide lost-dog and safety-oriented workflows.
- Make the application useful first as a focused dog-community product, while preserving room to grow into a larger network/platform.

The product should feel like a practical consumer application, not an AI demo.

---

## 2. Source-of-truth hierarchy

When context conflicts, use this precedence:

1. Current repository code on `main`.
2. Current Prisma schema and migrations.
3. Current environment/deployment configuration.
4. Current CI and production health checks.
5. `README.md` and `DEPLOYMENT.md`.
6. This `CLAUDE.md`.
7. Historical chat notes.

Before making a major architectural change, inspect the actual codebase.

Do not resurrect old implementations merely because they appear in historical notes.

---

## 3. Verified current technology stack

Current repository stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand 5 session/client state
- PostgreSQL
- Prisma 7 with the `@prisma/adapter-pg` driver adapter
- Upstash Redis
- Cloudflare R2
- Mapbox GL / `react-map-gl`
- Ably realtime/WebSockets
- Zod 4 validation
- QR code generation
- AWS S3-compatible SDK for R2
- Node.js >= 24
- Vercel production deployment
- GitHub Actions CI

Key package scripts currently include:

```bash
npm run dev
npm run typecheck
npm run lint
npm run build:ci
npm run check
npm run smoke:production
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:push
npm run prisma:studio
npm run db:seed
npm run db:reset
```

Prefer `npm run check` before considering a significant change complete.

---

## 4. Current application modules

The repository currently describes these modules:

- Dog profiles
- Owner profiles
- QR-based dog identity
- Public safety profile
- Lost-dog alerts
- Live last-seen events
- Dog-to-dog buddy relationships
- Walking invitations
- Walking requests
- Realtime messaging
- Realtime presence
- Mapbox route planning
- Flag waypoints
- Map-based nearby activity
- Cloudflare R2 media upload adapter
- Redis-backed temporary activity
- Redis-backed rate limiting

Claude should inspect the implementation status of each module before assuming feature completeness.

---

## 5. Product principles

Development should optimize for:

1. **Dog identity and safety**
2. **Reliable owner/dog profiles**
3. **Useful walking workflows**
4. **Social connections**
5. **Realtime communication**
6. **Location-aware activity**
7. **Simple consumer UX**
8. **Production reliability**
9. **Incremental scalability**

Avoid expanding scope solely for novelty.

When evaluating a new feature, ask:

- Does it make Buddies meaningfully more useful?
- Does it improve safety, walking, social connection, identity, retention, or network effects?
- Can it be tested with a small user base?
- Is it feasible without destabilizing core flows?
- Is there a measurable reason to build it now?

---

## 6. Historical UX/product vision

The following features and interaction concepts came from the project development history. Some may already exist, may be partially implemented, or may have changed.

### Dog social graph

Desired capabilities have included:

- Buddy requests
- Accept/reject buddy relationships
- Dog-to-dog social relationships
- Public dog profile pages
- Owner-controlled profile visibility
- Messaging between connected users
- Nearby dog activity
- Social discovery

Buddy/request workflows must not hang indefinitely. Mutations need explicit loading, success, and error states.

### Messaging

Historical goals:

- User/dog messaging
- Reliable message submission
- Realtime updates
- Presence
- Clear empty/error states
- Avoid optimistic UI that silently loses failed messages

Ably is now the realtime layer in the verified stack.

### Authentication/account flows

Historical requirements included:

- Email verification
- Password reset
- Session persistence
- Owner/account state
- Protected private routes
- Public-safe profile views

Do not expose private user information through public dog/QR routes.

### QR dog identity

QR functionality is a core differentiator.

Desired behavior:

- Each dog can have a shareable QR identity.
- QR should resolve to a public-safe profile.
- Public profile should prioritize contact/safety information appropriate for a lost/found dog.
- Sensitive owner/account data must remain private.

---

## 7. Social Map vision

The Social Map has been a major product direction.

Historical requirements included:

- Map-based nearby dog activity.
- Active dog avatars.
- A visual nearby/activity halo.
- Device/location-derived activity signals.
- Heat-map style visualization inspired by Snapchat's activity visualization.
- Community reporting inspired by Waze.
- Nearby dogs/activity rather than a static directory.
- Ability to evolve toward useful local dog-community intelligence.

Earlier discussions referenced a `device_loc` concept. Do **not** create or depend on that exact field without inspecting the current data model.

### Location safety/privacy

Location is sensitive.

Default design principles:

- Do not expose exact private/home coordinates publicly.
- Prefer bounded, coarse, temporary, or consent-based nearby activity.
- Avoid long-term storage of raw device location unless required.
- Use Redis/ephemeral state where appropriate for temporary presence.
- Never expose another user's precise location simply because the client can access it.
- Apply authorization server-side.

---

## 8. Walk Planner vision

The walk planner has had detailed interaction requirements.

Historical intended UX:

- Map-based route creation.
- Long press to establish a start location.
- Tap to place waypoints/flags.
- Multiple waypoint support.
- Snap route geometry to streets.
- Temporary/dotted route visualization while editing.
- Waypoints can be dragged/repositioned.
- Loop route back toward the start when appropriate.
- Driving/walking sequence concept:
  `start -> flag -> flag -> ... -> start`
- Double-tap/reposition interaction was explored.
- Default map framing should show useful local context rather than be excessively zoomed-in.
- Search/history field positioned as a floating map control.
- Collapsible/floating controls.
- Avoid UI chrome blocking the map.

Older experimental numeric requirements such as a “20,000 ft” view or “1000 ft elevation” should not be treated as current specifications unless they exist in code/product requirements.

### Route-planning engineering rules

- Keep editable waypoint state separate from computed route geometry.
- Make route calculation failures recoverable.
- Never discard user waypoints silently.
- Clearly distinguish an unsnapped draft route from a successfully routed path.
- Prevent stale route requests from overwriting newer edits.
- Map interactions must work on touch/mobile as well as mouse/desktop.

---

## 9. UI direction

Historical UI direction:

- Map-first experiences should maximize usable map area.
- Favor floating overlays rather than rigid stacked panels when appropriate.
- Controls should be collapsible.
- Some overlays were intended to use translucency.
- Keep actions discoverable without clutter.
- Avoid unnecessary “stack” controls or redundant buttons.
- Mobile responsiveness is mandatory.

Do not blindly reproduce old visual experiments. Preserve their goal: **clean, map-forward, low-friction interaction**.

---

## 10. State-management expectations

Zustand is part of the current stack.

Use client state for appropriate interactive/session UI state, but do not treat Zustand as a database.

General division:

- PostgreSQL/Prisma: durable application state.
- Redis: temporary/ephemeral/realtime-support state, rate limiting, short-lived activity.
- Zustand: browser/client state and interaction state.
- Ably: realtime events/presence.
- R2: media/blob storage.

Avoid duplicating durable entities into client stores as independent sources of truth.

---

## 11. Data and Prisma rules

Historical project failures included Prisma/schema mismatch, notably errors equivalent to a missing `public.Dog` table after deployment/migration changes.

Therefore:

- Never assume Prisma client generation means the database schema is deployed.
- Validate migrations explicitly.
- Do not use `prisma db push` as the production release mechanism.
- Production migrations must use explicit migrations.
- Keep migrations backward-compatible where possible.
- Destructive schema changes require an expand/migrate/contract strategy.
- Run `prisma generate` after schema changes.
- Inspect the actual production migration state before diagnosing a missing-table error.
- Seed scripts must match the current schema.

Current production path uses:

```bash
npm run prisma:deploy
```

The Vercel production build currently runs migrations before the Next.js build through the repository's `build` script.

CI deliberately uses `build:ci` so CI does not mutate a database.

---

## 12. Production environment variables

Current deployment documentation identifies these variables.

### Core

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
AUTH_SECRET
NEXT_PUBLIC_APP_URL
```

### Maps

```text
NEXT_PUBLIC_MAPBOX_TOKEN
```

Canonical browser token is `NEXT_PUBLIC_MAPBOX_TOKEN`.

The client token must be a Mapbox public token beginning with `pk.`.

### Realtime

```text
ABLY_API_KEY
NEXT_PUBLIC_ABLY_KEY
```

### Redis

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### Cloudflare R2

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
```

### Secret handling

Never:

- Print complete secret values.
- Commit `.env` files containing secrets.
- Embed server credentials into client-side code.
- Expose `DATABASE_URL`.
- Convert a secret token into `NEXT_PUBLIC_*` merely to make code work.

When diagnosing configuration, report whether a value is configured/valid without echoing it.

---

## 13. Deployment architecture

Production deployment path:

```text
main
  -> GitHub Actions CI
  -> Vercel build/deploy of same commit
  -> Production Smoke
  -> health/readiness verification
```

CI:

1. Install with Node 24.
2. Validate/generate Prisma.
3. Typecheck.
4. Lint.
5. Build without mutating the database.

Production smoke waits for Vercel to expose the intended commit SHA before considering the deployment valid.

### Health endpoints

Liveness:

```text
GET https://buddies.vercel.app/api/health
```

Readiness:

```text
GET https://buddies.vercel.app/api/health?deep=1
```

Deep readiness checks database/Redis and safe configuration status.

Before diagnosing “Vercel has old code,” compare the expected commit SHA with the deployment's reported commit SHA.

---

## 14. Historical deployment failures to keep in mind

Past development encountered issues such as:

- Vercel not appearing to deploy the latest commit.
- Production builds failing.
- Prisma schema/database mismatch.
- `/api/dogs` errors.
- Dog profiles appearing empty after migrations.
- Route/page-not-found issues.
- Social-map endpoints failing/blank.
- Walk planner loading inconsistently.
- Client actions hanging.
- Message submission failures.
- Route snapping not working.
- Walk creation failing with state resembling “no dog / no time.”

These are **historical incidents, not automatically current bugs**.

When one of them appears again:

1. Reproduce it.
2. Capture the exact route/request.
3. Check browser/server logs.
4. Check current commit SHA.
5. Check production readiness.
6. Inspect relevant DB migration/data state.
7. Fix root cause rather than adding another workaround.

---

## 15. Historical bug details

### Buddy requests

Past symptom:
- request action could hang.

Expected engineering behavior:
- explicit request lifecycle;
- mutation timeout/error handling;
- server-side validation;
- idempotence where useful;
- no duplicate buddy edges;
- actionable UI error;
- invalidate/refetch relevant relationship state after success.

### Messaging

Past symptom:
- messages sometimes failed to send.

Expected:
- validate sender/recipient authorization;
- persist before claiming durable success;
- realtime event should reflect persisted state;
- retry/recovery UX;
- no silent loss.

### Social map

Past symptom:
- `/api/social-map` returned blank/no usable data.

Expected:
- distinguish no nearby activity from API failure;
- validate location input;
- protect private position data;
- return structured errors;
- avoid leaking hidden/inactive users.

### Walk creation

Past symptom:
- creation could fail due to missing selected dog/time state.

Expected:
- form/state validation before submit;
- useful defaults only when semantically safe;
- server validation regardless of client checks.

### Walk route interaction

Past symptoms:
- long press did not set start;
- dragging eventually worked but snap-to-road failed;
- `/walks` routing/page-not-found issues occurred.

Expected:
- test mouse and touch handlers separately;
- confirm Mapbox routing request/response;
- avoid event-handler conflicts;
- preserve raw waypoint state when routing fails.

---

## 16. Security baseline

Current deployment already applies a security-header baseline.

Maintain:

- HTTPS/HSTS
- clickjacking protection
- MIME-sniffing protection
- restrictive referrer policy
- geolocation restricted to application origin
- camera/microphone/payment APIs disabled unless explicitly needed
- framework-identification header disabled

Application-layer rules:

- Validate inputs with Zod.
- Authorize on the server, not just in React.
- Treat dog public profiles separately from private owner records.
- Rate-limit abuse-sensitive endpoints.
- Do not trust client-supplied user IDs.
- Do not trust client-supplied relationship status.
- Validate upload type/size/path.
- Presigned media access must not provide unintended bucket access.
- Do not log secrets or private location data.
- Protect realtime channels with proper authorization.

---

## 17. Reliability standards

For every important mutation:

- loading state;
- success state;
- error state;
- server validation;
- authorization;
- useful logs;
- no infinite spinner;
- retry strategy where appropriate.

For every API route:

- consistent status codes;
- structured error responses;
- no secret leakage;
- clear distinction among:
  - unauthorized,
  - forbidden,
  - not found,
  - validation failure,
  - conflict,
  - infrastructure failure.

---

## 18. Development workflow

Default engineering workflow for Claude:

1. Inspect current repository state.
2. Understand the affected data model/API/UI flow.
3. Reproduce or characterize the problem.
4. Make the smallest coherent change.
5. Add/update validation.
6. Run relevant checks.
7. Run full validation when practical.
8. Summarize changed files and behavior.
9. Identify migration/environment/deployment implications.
10. Do not claim production success without evidence.

Preferred validation:

```bash
npm run check
```

At minimum for smaller changes:

```bash
npm run typecheck
npm run lint
npm run build:ci
```

For Prisma changes:

```bash
npm run prisma:validate
npm run prisma:generate
```

Also create an explicit migration when the durable schema changes.

---

## 19. Git conventions

Repository: `Alendor22/Buddies_SPA`

Primary development target historically has been `main`, but Claude should avoid destructive direct changes without understanding current branch policy.

Guidelines:

- Inspect `git status` before editing.
- Do not delete unrelated user work.
- Do not reset/rebase destructively unless explicitly requested.
- Keep commits focused.
- Explain migrations and environment changes in commit/PR context.
- Never commit secrets.
- Treat generated files carefully.
- Do not assume local WSL and Vercel environments are identical.

---

## 20. Local environment context

Primary development environment:

- Windows 11 host
- WSL Ubuntu
- VS Code connected to WSL
- repository intended at:

```text
/home/motoscucci/coding/Buddies_SPA
```

GitHub CLI authentication has been configured in WSL for GitHub account:

```text
Alendor22
```

An obsolete historical copy existed under:

```text
/mnt/c/Users/motos/Downloads/dogid-app-v1
```

Do not use that old path as the active repository.

Prefer Linux-native WSL project storage rather than running the active Node project from `/mnt/c/...`.

---

## 21. Architecture guidance for future work

Favor a modular monolith unless demonstrated scale requires more.

Do not prematurely split Buddies into microservices.

Preferred boundaries:

### Identity/account
- authentication
- owner profile
- account/session

### Dogs
- dog profile
- dog media
- dog identity/QR
- public safety representation

### Social
- buddy graph
- invitations
- relationship state

### Messaging/realtime
- conversations
- messages
- presence
- live events

### Walks
- walk entity
- participants/invitations
- scheduled time
- route/waypoints

### Location/social map
- nearby activity
- ephemeral position/activity
- safety/privacy
- community reports

### Media
- upload
- R2 metadata
- public/private media access

Keep boundaries clear even if they remain in one Next.js application.

---

## 22. API design principles

Prefer domain-oriented routes and explicit actions.

Avoid huge catch-all endpoints.

Mutations should be safely repeatable where user double-submission is plausible.

Use transactions when a single logical action modifies multiple durable records.

Examples:

- buddy relationship creation;
- accepting an invitation;
- creating a walk plus participants;
- message persistence + related conversation metadata.

Do not rely on realtime events as the durable system of record.

---

## 23. Realtime principles

Ably is for realtime communication/presence, not primary persistence.

General flow for durable events:

```text
client mutation
  -> server authorization/validation
  -> database commit
  -> realtime publish
  -> subscribed clients update/refetch
```

If realtime publish fails after persistence, the durable state still wins.

Design clients to recover via refetch/reconciliation.

---

## 24. Media principles

Cloudflare R2 is the media store.

Use:

- validated file types;
- file-size caps;
- collision-resistant object keys;
- ownership metadata;
- controlled public/private policy;
- server-generated presigned operations when appropriate.

Do not store large binary media in PostgreSQL.

---

## 25. Mapbox principles

Mapbox is central to map experiences.

Keep:

- map visualization state;
- application location entities;
- route geometry;
- editable route waypoints

conceptually separate.

Do not let a rendered polyline become the sole route source of truth.

Public Mapbox token belongs in:

```text
NEXT_PUBLIC_MAPBOX_TOKEN
```

Do not ship secret Mapbox credentials to the browser.

---

## 26. Mobile-first expectations

Buddies should be usable from a phone.

For map flows:

- touch interaction must be first-class;
- controls need usable hit targets;
- overlays must not cover critical map actions;
- dialogs must fit small screens;
- keyboard/open search behavior must not destroy map usability;
- long-press interactions should have visible feedback;
- avoid desktop-only hover dependencies.

---

## 27. Founder/product operating style

When proposing product changes, prefer concise evaluation rather than adding everything.

A useful decision ladder from prior project discussions:

- Possible
- Feasible
- Doable
- Highly interested

Translate concepts into testable product opportunities before committing substantial engineering effort.

For a new feature proposal, Claude should preferably provide:

- problem;
- user value;
- smallest testable version;
- dependencies;
- risk;
- success metric;
- recommendation.

---

## 28. AI strategy

Buddies should not add AI merely for branding.

AI-enabled features should have practical value.

Potential future categories may include:

- lost-dog matching/triage;
- safety/event summarization;
- smarter walk recommendations;
- owner support;
- moderation;
- community intelligence;
- operational/admin automation.

Any AI functionality should be:

- measurable;
- privacy-aware;
- optional where appropriate;
- cost-aware;
- robust to failure;
- not required for basic core functionality.

---

## 29. Near-term product priority framework

Unless the repository or owner specifies otherwise, prioritize work approximately in this order:

### P0 — production integrity
- builds;
- migrations;
- auth;
- production readiness;
- broken critical routes;
- data-loss/security defects.

### P1 — core dog identity
- owner/dog profiles;
- public safety profile;
- QR identity;
- profile reliability.

### P2 — social reliability
- buddy requests;
- relationships;
- messaging;
- realtime state.

### P3 — walk workflow
- create/schedule walk;
- invitations;
- route planner;
- route persistence.

### P4 — social map
- nearby activity;
- presence;
- heat/activity representation;
- privacy-safe community signals.

### P5 — product expansion
- reporting;
- advanced discovery;
- AI workflows;
- monetization/growth experiments.

Do not polish P5 while P0/P1 behavior is unreliable.

---

## 30. Definition of done

A feature is not done because the UI renders.

For production-facing work, completion normally requires:

- correct behavior;
- validated inputs;
- authorization;
- durable data correctness;
- loading/error/empty states;
- responsive/mobile behavior;
- TypeScript passes;
- lint passes;
- production build passes;
- migration included if needed;
- environment requirements documented;
- failure mode considered;
- no exposed secrets;
- no obvious privacy regression.

For release-critical work, also verify production smoke/readiness.

---

## 31. Working instructions for Claude Code

When beginning a session in this repository:

1. Read this file.
2. Read `README.md`.
3. Read `DEPLOYMENT.md`.
4. Inspect `package.json`.
5. Inspect `prisma/schema.prisma`.
6. Inspect relevant App Router pages/routes before suggesting changes.
7. Check `git status`.
8. Check recent commits if task context depends on recent work.
9. Do not assume historical bugs remain active.
10. Do not rewrite major systems unless the current implementation warrants it.

When asked to fix something:

- identify root cause first;
- state which files/flows are involved;
- patch coherently;
- validate;
- report what was actually verified.

When asked to build a feature:

- fit it into existing architecture;
- preserve current conventions;
- avoid duplicate models/services;
- include server-side validation and authorization;
- consider migration/deployment effects;
- make the smallest production-quality implementation.

---

## 32. Do not do these things

Do **not**:

- use the obsolete `dogid-app-v1` directory as authoritative;
- replace Prisma migrations with production `db push`;
- expose environment secrets;
- put durable state only in Zustand;
- use Ably as the database;
- expose exact user location unnecessarily;
- trust user IDs supplied by clients;
- silently swallow failed mutations;
- leave indefinite loading states;
- claim a Vercel deploy is current without checking commit identity;
- add a second implementation of an existing feature without inspecting the first;
- refactor unrelated code during a narrow bug fix;
- delete working functionality to make a test pass;
- weaken security checks for development convenience.

---

## 33. Historical context vs. current reality

This file intentionally includes historical ChatGPT project context so development can continue without losing product intent.

However, historical statements fall into three categories:

### A. Verified/current
Facts confirmed by current repository files, such as the main stack, deployment model, and health endpoints.

### B. Product intent
Requested interactions/features that remain useful design context but may not be fully implemented.

### C. Historical failures
Past bugs that may already be fixed.

Claude must distinguish these categories.

When uncertain, inspect the code and test the current behavior rather than treating the historical conversation as ground truth.

---

## 34. Current verified operational baseline

At the time this context was consolidated, repository documentation establishes:

- production is deployed from `main` to Vercel;
- GitHub Actions performs CI;
- Node 24 is required;
- Prisma migrations are explicit;
- health and deep-readiness endpoints exist;
- production smoke checks match intended Vercel commit SHA;
- PostgreSQL, Redis, Mapbox, auth, Ably, and R2 configuration can be represented in readiness checks;
- rollback uses a prior Vercel deployment plus a corresponding repository revert;
- destructive database changes require staged migration strategy.

This operational discipline should be preserved.

---

## 35. Session handoff format

At the end of substantial Claude Code work, provide a compact handoff:

```md
## Completed
- ...

## Changed
- `path/to/file`: ...

## Validation
- `npm run typecheck`: pass/fail
- `npm run lint`: pass/fail
- `npm run build:ci`: pass/fail

## Database / env impact
- None / describe migration or variables

## Remaining
- ...

## Production
- Not deployed / deployed commit `<sha>`
- Health/readiness result if verified
```

This makes future AI-assisted sessions easier to resume.

---

## 36. Current mission

Continue evolving Buddies into a reliable, production-quality dog identity, safety, walking, and social-network platform.

The immediate engineering bias should be:

**stability -> identity/safety -> social reliability -> walks/maps -> growth/AI**

Preserve the product's distinctive direction—dog identity, QR safety, social graph, live nearby activity, and map-based walk coordination—while avoiding uncontrolled scope expansion.

