import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.mjs',
  },
  datasource: {
    // Prisma CLI operations should use Neon's direct connection when available.
    url: process.env.DATABASE_URL_UNPOOLED ?? env('DATABASE_URL'),
  },
});
