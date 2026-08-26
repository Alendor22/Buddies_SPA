# Deployment preview policy

Buddies uses GitHub Actions as the default validation path for feature branches and pull requests.

Automatic Vercel Git deployments are intentionally limited to:

- `main` for production
- `preview` for an intentional shared preview
- `preview/**` for explicitly requested preview branches

All other Git branches are suppressed by `vercel.json` so routine feature, fix, performance, chore, docs, CI, and refactor commits do not create disposable Vercel deployments or consume Neon preview database branches.

## Why

The Neon/Vercel integration can create a database branch for each preview deployment. Repeated automatic previews can exhaust the Neon branch quota before the application build starts.

## Validation workflow

Feature branches continue to use GitHub Actions for:

- locked dependency install
- phase contract audit
- Prisma validation and client generation
- TypeScript typecheck
- lint
- production-style CI build

Use the `preview` branch namespace only when a browser-accessible Vercel preview is actually required.
