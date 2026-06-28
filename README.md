# Buddies SPA V2

Production-oriented scaffold for a dog identity, safety, walking, and social network.

## Stack

- Next.js 15 App Router
- React 19 + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- Upstash Redis
- Cloudflare R2
- Mapbox
- Ably WebSockets/realtime
- Zod validation

## V2 modules

- Dog and owner profiles
- QR-based dog identity
- Public safety profile
- Lost-dog alerts and live last-seen events
- Walker discovery and walk requests
- Realtime messaging and presence
- Map-based nearby activity
- Media upload adapter for Cloudflare R2
- Redis-backed caching/rate-limit utilities

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

Deploy the Next.js application to Vercel or another Node-compatible host. Use a managed PostgreSQL provider, Upstash Redis, Cloudflare R2, Mapbox, and Ably.
