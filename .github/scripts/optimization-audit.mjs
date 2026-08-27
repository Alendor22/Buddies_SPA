#!/usr/bin/env node
// Reports regressions in the areas that have actually cost this project money:
// client polling, dependency vulnerabilities, and missing security headers.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const out = [];
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
out.push(`## Audit — ${stamp} UTC\n`);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

// --- 1. Polling regression guard -------------------------------------------
// The /api/social-map incident: an 8s interval whose effect depended on GPS
// coordinates, so it restarted (and refetched) on every location tick.
const POLL_THRESHOLD_MS = 30_000;
const polls = [];
for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/setInterval\([^,]*,\s*([\d_]+)\s*\)/);
    if (!m) return;
    const ms = Number(m[1].replace(/_/g, ''));
    if (ms < POLL_THRESHOLD_MS) {
      polls.push(`- \`${file}:${i + 1}\` — interval of ${ms}ms (under ${POLL_THRESHOLD_MS}ms)`);
    }
  });
}
out.push('### Client polling');
out.push(polls.length
  ? `Found ${polls.length} short interval(s). Prefer a realtime subscription:\n${polls.join('\n')}`
  : 'No short polling intervals found.');

// --- 2. Dependency vulnerabilities -----------------------------------------
out.push('\n### Dependency vulnerabilities');
try {
  const raw = execSync('npm audit --audit-level=high --json', { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
  const v = JSON.parse(raw).metadata?.vulnerabilities ?? {};
  out.push(`critical: ${v.critical ?? 0} · high: ${v.high ?? 0} · moderate: ${v.moderate ?? 0} · low: ${v.low ?? 0}`);
} catch (err) {
  try {
    const v = JSON.parse(err.stdout || '{}').metadata?.vulnerabilities ?? {};
    out.push(`critical: ${v.critical ?? 0} · high: ${v.high ?? 0} · moderate: ${v.moderate ?? 0} · low: ${v.low ?? 0}`);
  } catch {
    out.push('npm audit did not return parseable output.');
  }
}

// --- 3. Security headers ----------------------------------------------------
out.push('\n### Security headers');
const cfg = ['next.config.ts', 'next.config.js', 'next.config.mjs'].find(existsSync);
if (!cfg) {
  out.push('No next.config found.');
} else {
  const text = readFileSync(cfg, 'utf8');
  const want = [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Content-Security-Policy',
    'Permissions-Policy'
  ];
  const missing = want.filter((h) => !text.includes(h));
  out.push(missing.length ? `Missing from \`${cfg}\`: ${missing.join(', ')}` : 'All baseline headers present.');
}

// --- 4. Outdated direct dependencies ---------------------------------------
out.push('\n### Outdated direct dependencies');
try {
  const raw = execSync('npm outdated --json', { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }) || '{}';
  const data = JSON.parse(raw);
  const majors = Object.entries(data)
    .filter(([, i]) => i.current && i.latest && i.current.split('.')[0] !== i.latest.split('.')[0])
    .map(([n, i]) => `- ${n}: ${i.current} → ${i.latest}`);
  out.push(majors.length ? `Major version gaps:\n${majors.join('\n')}` : 'No major version gaps.');
} catch (err) {
  try {
    const data = JSON.parse(err.stdout || '{}');
    const majors = Object.entries(data)
      .filter(([, i]) => i.current && i.latest && i.current.split('.')[0] !== i.latest.split('.')[0])
      .map(([n, i]) => `- ${n}: ${i.current} → ${i.latest}`);
    out.push(majors.length ? `Major version gaps:\n${majors.join('\n')}` : 'No major version gaps.');
  } catch {
    out.push('npm outdated did not return parseable output.');
  }
}

console.log(out.join('\n'));
