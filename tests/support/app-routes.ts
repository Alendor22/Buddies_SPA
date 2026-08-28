import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

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

function isRouteSegment(segment: string) {
  return !(segment.startsWith('(') && segment.endsWith(')')) && !segment.startsWith('@');
}

export function discoverPageRouteTemplates(appDirectory = 'src/app') {
  return walk(appDirectory)
    .filter((file) => file.endsWith('/page.tsx'))
    .map((file) => {
      const relativeDirectory = path.posix.dirname(path.posix.relative(appDirectory, file));
      const segments = relativeDirectory === '.'
        ? []
        : relativeDirectory.split('/').filter(isRouteSegment);
      return `/${segments.join('/')}`;
    })
    .sort();
}

export function dynamicParameterNames(template: string) {
  const names: string[] = [];
  for (const match of template.matchAll(/\[\[?\.\.\.([^\]]+)\]\]?|\[([^\]]+)\]/g)) {
    names.push(match[1] || match[2]);
  }
  return names;
}

export function materializePageRoute(template: string, parameters: Record<string, string>) {
  return template.replace(/\[\[?\.\.\.([^\]]+)\]\]?|\[([^\]]+)\]/g, (_match, catchAll, single) => {
    const name = catchAll || single;
    const value = parameters[name];
    if (!value) throw new Error(`Missing route-state fixture for dynamic parameter "${name}" in ${template}.`);
    return catchAll
      ? value.split('/').map(encodeURIComponent).join('/')
      : encodeURIComponent(value);
  });
}
