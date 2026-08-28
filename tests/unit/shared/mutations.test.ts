import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  cleanPlainText,
  mapPrismaWriteError,
  mutationFailure,
  mutationSuccess,
  optionalPlainText
} from '@/lib/mutations';

describe('mutation helpers', () => {
  it('sanitizes control characters, whitespace, and length', () => {
    expect(cleanPlainText('  hello\u0000 world  ', 20)).toBe('hello world');
    expect(cleanPlainText('abcdef', 3)).toBe('abc');
    expect(optionalPlainText('   ', 10)).toBeNull();
  });

  it('creates discriminated results', () => {
    expect(mutationSuccess({ id: 'dog-1' })).toEqual({ ok: true, data: { id: 'dog-1' } });
    expect(mutationFailure({ code: 'NOPE', formError: 'Nope' })).toEqual({
      ok: false,
      code: 'NOPE',
      formError: 'Nope'
    });
  });

  it('maps unique and missing Prisma writes to stable public failures', () => {
    const unique = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['ownerId', 'name'] }
    });
    const missing = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: '6.19.3'
    });

    expect(mapPrismaWriteError(unique)).toMatchObject({
      ok: false,
      code: 'CONFLICT',
      fieldErrors: { 'ownerId,name': 'This value must be unique.' }
    });
    expect(mapPrismaWriteError(missing)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(mapPrismaWriteError(new Error('secret database detail'))).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
      formError: 'We could not save your changes. Please try again.'
    });
  });
});
