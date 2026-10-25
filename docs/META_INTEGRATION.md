# Meta social integrations — gated implementation

Branch: `feature/meta-social-integrations`. Clerk remains the sole authentication/session authority. Never replace Clerk sessions with Meta tokens.

## Implemented foundation
- Official Graph API request helper with bearer authentication, fixed Graph host, constrained paths, timeout and no-store.
- Facebook and WhatsApp public HTTPS share-link builders (no Meta access token required).
- WhatsApp Cloud API approved-template send helper (not exposed as a public endpoint).
- Meta webhook challenge and HMAC-SHA256 signature verification. POST deliberately returns 503 after successful signature validation until durable idempotent processing exists; **not production ready**.
- Unit tests for signature validation, challenge verification and share URL constraints.

## Not yet implemented — release blockers
- Clerk dashboard Facebook OAuth connection and verified redirect testing. Configure Facebook as a social provider through Clerk; do not implement competing sessions.
- Meta OAuth authorization-code flow, CSRF state, exact redirect URI validation, token exchange, encrypted server-side storage and revocation.
- Facebook Pages and Instagram professional-account permissions, publishing/insights adapters, account selection and per-user ownership checks.
- WhatsApp Cloud API opt-in, business account/phone-number linking, template approval, delivery-status webhooks, rate limits, retries, and idempotent processing.
- Persistent webhook event queue and signature-tested processing; no customer message should be acknowledged before durable receipt.
- Instagram sharing: use supported native share/deep-link UX or professional-account publishing API; ordinary personal-account publishing is not interchangeable with professional-account APIs.
- Security, unit/integration/E2E tests, CI, Meta App Review/Business Verification where applicable, and two-user acceptance.

## Configuration (server-only)
`META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and, after secure connection flows are implemented, account-specific access tokens in encrypted storage. Never expose app secrets or business tokens via NEXT_PUBLIC variables.

Meta Graph API permissions and version support must be verified against the current official documentation before enabling each capability. Do not enable outbound messaging or publishing before consent, approved permissions and audit logging.
