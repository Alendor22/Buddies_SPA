import { randomUUID } from 'node:crypto';

export function uniqueTestId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}
