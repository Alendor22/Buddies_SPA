# Buddies state, configuration, and write boundaries

## State ownership

Buddies uses four explicit state classes.

1. **Server state** — PostgreSQL/API data is authoritative for users, dogs, buddy relationships, messages, notifications, saved routes, check-ins, walk invitations, presence, and account/auth records. Client stores may reference or cache server data but may not become the source of truth.
2. **Shared client workflow state** — Zustand owns cross-component ephemeral workflows such as route construction, selected map context, shared panel state, and mutation progress that must survive component boundaries.
3. **Component-local state** — React `useState`/form state owns unsaved field values, focus, disclosure state, temporary previews, and component-only loading indicators.
4. **Derived state** — counts, labels, disablement, filters, distances, and other values that can be calculated from canonical state are computed rather than stored redundantly.

## Persistence policy

Browser persistence is allow-listed. Persist only safe continuity data such as unfinished route geometry, map viewport, and non-sensitive user workflow preferences.

Never persist:

- access tokens, credentials, secrets, or configuration payloads;
- auth/session material;
- validation or database errors;
- pending mutation flags;
- stale copies of server-owned entities;
- transient network/loading state.

## Mapbox boundary

All Mapbox configuration is owned by `MapboxProvider` and the `/api/maps/*` server boundary.

- Mapbox credentials are never persisted in Zustand or browser storage.
- Client map components consume configuration through the provider boundary.
- Directions/static/config requests remain behind Buddies API routes rather than being distributed throughout UI components.
- Mapbox-specific failure states are translated into Buddies application states/messages at the boundary.

The existing `walkPlanner.token` field is transitional runtime compatibility only and must remain blank in persisted state until all legacy map consumers have moved to `useMapboxConfig()`; it is then removed.

## Mutation contract

Every database write must follow:

`UI input -> local form state -> client validation -> allow-listed DTO -> server validation/sanitization -> authorization -> Prisma -> database -> canonical response -> refresh/invalidate server state -> UI state`

No request body or `FormData` object may be spread directly into Prisma.

Every write endpoint must:

- allow-list accepted fields;
- normalize strings, numbers, dates, booleans, URLs, enums, and empty optional values;
- reject invalid domain values before Prisma;
- enforce authorization/ownership independently of validation;
- protect immutable identifiers and state invariants;
- translate expected Prisma conflicts/not-found errors to application errors;
- log unexpected errors server-side without exposing raw database details;
- reserve HTTP 500 behavior for truly unexpected infrastructure/runtime failures.

## User-facing errors

Validation failures appear at the affected field whenever a field can be identified. Form-level errors are reserved for cross-field conflicts or unexpected failures.

Mutation UI uses the canonical lifecycle:

- `idle`
- `submitting`
- `success`
- `validation-error`
- `conflict`
- `unauthorized`
- `error`

Shared mutation result types live in `src/lib/mutations.ts`.

## Identifier policy

Public identifiers such as dog slugs are stable once created. Ordinary profile edits must not regenerate them. Any future identifier-change feature requires a dedicated operation with redirect/back-reference handling for previously shared URLs and QR codes.

## Migration rule

Legacy broad patch actions may remain temporarily for compatibility, but new shared state changes should use explicit domain actions. Server-owned records should be removed from long-lived client stores as each feature is migrated.
