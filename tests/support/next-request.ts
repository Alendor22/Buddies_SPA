import { NextRequest } from 'next/server';

export function formRequest(
  path: string,
  values: Record<string, string>,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    body.set(key, value);
  }

  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method,
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' }
  });
}

export function jsonRequest(path: string, value: unknown, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST') {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method,
    body: JSON.stringify(value),
    headers: { 'content-type': 'application/json' }
  });
}
