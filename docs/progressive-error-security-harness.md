# Progressive Error-Security Harness

Every production defect that is reproduced and cleared becomes a permanent regression/security case before the next progressive gate advances.

## Recorded cases

1. **Prisma Vercel runtime compatibility** — Prisma schema must generate both native and `rhel-openssl-3.0.x` engines.
2. **Authentication schema compatibility** — the committed production migration must create `User.sessionVersion` before auth code depends on it.
3. **Password reset enumeration resistance** — public reset responses remain indistinguishable for existing, missing, verified, and unverified accounts.
4. **Password reset delivery observability** — missing Resend configuration and provider rejection/failure must produce structured server-side error events and must never be silently swallowed.

## Gate rule

Reproduce -> isolate -> smallest fix -> regression/security case -> relevant suite -> full validation -> advance.
