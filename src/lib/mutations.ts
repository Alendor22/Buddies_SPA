import { Prisma } from '@prisma/client';

export type MutationStatus =
  | 'idle'
  | 'submitting'
  | 'success'
  | 'validation-error'
  | 'conflict'
  | 'unauthorized'
  | 'error';

export type MutationSuccess<T> = {
  ok: true;
  data: T;
};

export type MutationFailure = {
  ok: false;
  fieldErrors?: Record<string, string>;
  formError?: string;
  code?: string;
};

export type MutationResult<T> = MutationSuccess<T> | MutationFailure;

export function mutationSuccess<T>(data: T): MutationSuccess<T> {
  return { ok: true, data };
}

export function mutationFailure(input: Omit<MutationFailure, 'ok'>): MutationFailure {
  return { ok: false, ...input };
}

export function mapPrismaWriteError(error: unknown): MutationFailure {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? 'field');
      return mutationFailure({
        code: 'CONFLICT',
        formError: 'That value is already in use.',
        fieldErrors: { [target]: 'This value must be unique.' }
      });
    }

    if (error.code === 'P2025') {
      return mutationFailure({ code: 'NOT_FOUND', formError: 'The requested record no longer exists.' });
    }
  }

  return mutationFailure({
    code: 'INTERNAL_ERROR',
    formError: 'We could not save your changes. Please try again.'
  });
}

export function cleanPlainText(value: unknown, maxLength: number) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function optionalPlainText(value: unknown, maxLength: number) {
  const cleaned = cleanPlainText(value, maxLength);
  return cleaned || null;
}
