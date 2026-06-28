# DogID App

Version 1 of a dog digital identity + safety network.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma
- Cloudflare R2
- Upstash Redis
- Mapbox
- Ably realtime

## V1 Features

- Dog profile
- QR identity
- Public dog safety page
- Lost dog mode
- Emergency/medical info
- Last-seen map
- Realtime lost dog and QR scan events via Ably

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## GitHub Push

```bash
git init
git add .
git commit -m "Initial DogID V1 scaffold"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dogid-app.git
git push -u origin main
```

## Notes

This is a scaffold. Add authentication before production use.
Recommended auth: Clerk or NextAuth.
