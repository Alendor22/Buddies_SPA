const baseUrl = (process.env.DEPLOYMENT_URL || 'https://buddies.vercel.app').replace(/\/$/, '');
const expectedCommit = process.env.EXPECTED_COMMIT_SHA || '';
const attempts = Number(process.env.SMOKE_ATTEMPTS || 30);
const intervalMs = Number(process.env.SMOKE_INTERVAL_MS || 10000);
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS || 8000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: 'follow',
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Buddies-Deployment-Smoke/1.0',
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReadyDeployment() {
  let lastReason = 'No response received.';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await request(`/api/health?deep=1&smoke=${Date.now()}`);
      const payload = await response.json();
      const deployedCommit = payload?.deployment?.commitSha || '';
      const commitMatches = !expectedCommit || deployedCommit === expectedCommit;
      const mapboxReady = payload?.checks?.mapbox?.status === 'configured';

      if (response.ok && payload?.ready === true && commitMatches && mapboxReady) {
        console.log(`Deployment ready on attempt ${attempt}.`);
        console.log(`Commit: ${deployedCommit || 'not reported'}`);
        console.log(`Database latency: ${payload?.checks?.database?.latencyMs ?? 'n/a'} ms`);
        return payload;
      }

      lastReason = [
        `HTTP ${response.status}`,
        `ready=${String(payload?.ready)}`,
        `commit=${deployedCommit || 'missing'}`,
        `expected=${expectedCommit || 'any'}`,
        `mapbox=${payload?.checks?.mapbox?.status || 'unknown'}`
      ].join(', ');
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }

    console.log(`Waiting for production deployment (${attempt}/${attempts}): ${lastReason}`);
    if (attempt < attempts) await delay(intervalMs);
  }

  throw new Error(`Production did not become ready: ${lastReason}`);
}

async function verifyPublicRoutes() {
  const checks = [
    ['/', [200]],
    ['/dogs', [200]],
    ['/auth/login', [200]],
    ['/auth/register', [200]],
    ['/api/health', [200]],
    ['/api/maps/config', [200]]
  ];

  for (const [path, acceptedStatuses] of checks) {
    const response = await request(path);
    if (!acceptedStatuses.includes(response.status)) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }
    console.log(`PASS ${path} HTTP ${response.status}`);
  }
}

async function verifySecurityHeaders() {
  const response = await request('/');
  const expected = {
    'strict-transport-security': 'max-age=',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin'
  };

  for (const [name, expectedValue] of Object.entries(expected)) {
    const actual = response.headers.get(name) || '';
    if (!actual.toLowerCase().includes(expectedValue.toLowerCase())) {
      throw new Error(`Security header ${name} is missing or invalid.`);
    }
    console.log(`PASS security header ${name}`);
  }

  if (response.headers.has('x-powered-by')) {
    throw new Error('x-powered-by must not be exposed.');
  }
  console.log('PASS framework identification header disabled');
}

try {
  await waitForReadyDeployment();
  await verifyPublicRoutes();
  await verifySecurityHeaders();
  console.log('Production smoke checks passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
