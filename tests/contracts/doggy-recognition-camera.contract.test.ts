import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/lib/doggy-recognition/camera.ts'), 'utf8');

describe('Doggy Recognition visual-first contract', () => {
  it('defines separate identify and confirmation thresholds', () => {
    expect(source).toContain('IDENTIFY_THRESHOLD');
    expect(source).toContain('CONFIRM_THRESHOLD');
  });

  it('supports unknown dogs instead of requiring a registered identity', () => {
    expect(source).toContain("kind: 'unknown'");
  });

  it('has a non-overlapping responsive frame sampling guard', () => {
    expect(source).toContain('!input.busy');
    expect(source).toContain('documentVisible');
    expect(source).toContain('CAMERA_SAMPLE_INTERVAL_MS');
  });

  it('does not encode ownership or authorization into visual recognition results', () => {
    expect(source).not.toMatch(/ownerId|userId|authorize|authenticated/i);
  });
});
