import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../test-suite.manifest.json';
import {
  discoverPageRouteTemplates,
  dynamicParameterNames,
  materializePageRoute
} from '../support/app-routes';

function walk(directory: string, files: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      walk(absolute, files);
    } else {
      files.push(absolute.split(path.sep).join('/'));
    }
  }
  return files;
}

describe('progressive application test inventory', () => {
  const appFiles = walk('src/app');
  const surfaces = appFiles.filter((file) => file.endsWith('/page.tsx') || file.endsWith('/route.ts'));
  const apiRoutes = surfaces.filter((file) => file.startsWith('src/app/api/')).sort();
  const registeredRoutes = manifest.apiPolicies.map((entry) => entry.route).sort();

  it('classifies every API route with an explicit access policy', () => {
    expect(registeredRoutes).toEqual(apiRoutes);
  });

  it('maps every page and route to a product capability', () => {
    const unmapped = surfaces.filter((file) => !manifest.capabilities.some((capability) =>
      capability.sourcePrefixes.some((prefix) => file.startsWith(prefix))
    ));

    expect(unmapped).toEqual([]);
  });

  it('keeps policy vocabulary explicit and machine-readable', () => {
    const allowedAccess = new Set([
      'public',
      'authenticated',
      'service-secret',
      'development-only',
      'mixed',
      'review-required'
    ]);
    const allowedStates = new Set(['covered', 'backlog']);

    expect(manifest.apiPolicies.every((entry) => allowedAccess.has(entry.access))).toBe(true);
    expect(manifest.apiPolicies.every((entry) => allowedStates.has(entry.testState))).toBe(true);
  });

  it('associates every capability with a live test or backlog contract', () => {
    const testFiles = walk('tests').filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
    const withoutTests = manifest.capabilities.filter((capability) =>
      !testFiles.some((file) => capability.testPrefixes.some((prefix) => file.startsWith(prefix)))
    );

    expect(withoutTests).toEqual([]);
  });

  it('keeps every page route in the HTTP 200 verification inventory', () => {
    const templates = discoverPageRouteTemplates();
    const parameters = manifest.routeState200.dynamicParameters;
    const missingParameters = [...new Set(templates.flatMap(dynamicParameterNames))]
      .filter((name) => !Object.prototype.hasOwnProperty.call(parameters, name));
    const concreteRoutes = templates.map((template) => materializePageRoute(template, parameters));

    expect(missingParameters).toEqual([]);
    expect(new Set(concreteRoutes).size).toBe(concreteRoutes.length);
    expect(concreteRoutes).toContain('/');
  });
});
