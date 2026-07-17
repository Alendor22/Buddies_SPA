import fs from 'node:fs';

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const source = fs.readFileSync(schemaPath, 'utf8');

const next = source.replace(
  /generator client \{[\s\S]*?\}\s*datasource db \{[\s\S]*?\}/,
  `generator client {\n  provider = "prisma-client"\n  output   = "../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}`,
);

if (next === source && !source.includes('provider = "prisma-client"')) {
  throw new Error('Unable to migrate prisma/schema.prisma to the Prisma 7 format.');
}

if (next !== source) {
  fs.writeFileSync(schemaPath, next);
  console.log('Prepared prisma/schema.prisma for Prisma 7.');
}
