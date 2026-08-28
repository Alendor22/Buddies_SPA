import { pbkdf2Sync, randomBytes } from 'node:crypto';

export function hashTestPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex');
  return 'pbkdf2_sha256$120000$' + salt + '$' + hash;
}
