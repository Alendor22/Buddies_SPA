# Neon branch quota recovery

If Vercel reports `Branch limit reached` during `Create database branch for deployment`, the failure is coming from the Neon integration before the application build runs.

## One-time recovery

1. Open the Neon project connected to Buddies.
2. Open **Branches**.
3. Delete stale branches created for old Vercel preview deployments, keeping the production/default branch and any branch still intentionally in use.
4. Retry only an intentional preview deployment after capacity is available.

The repository now prevents routine Git branches from automatically creating new Vercel previews. GitHub Actions remains the normal CI path for those branches.
