#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const manifest = JSON.parse(readFileSync('tests/test-suite.manifest.json', 'utf8'));

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) walk(absolute, files);
    else files.push(absolute.split(path.sep).join('/'));
  }
  return files;
}

const testFiles = walk('tests').filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
const layers = ['unit', 'component', 'integration', 'database', 'contracts', 'e2e'];
const covered = manifest.apiPolicies.filter((entry) => entry.testState === 'covered').length;
const total = manifest.apiPolicies.length;

console.log('Buddies progressive test suite');
console.log('-------------------------------');
for (const layer of layers) {
  const count = testFiles.filter((file) => file.startsWith('tests/' + layer + '/')).length;
  console.log(layer.padEnd(12) + String(count).padStart(3) + ' file(s)');
}
console.log('');
console.log('Capabilities mapped: ' + manifest.capabilities.length);
console.log('API policies covered: ' + covered + '/' + total);
console.log('API policy backlog: ' + (total - covered));
