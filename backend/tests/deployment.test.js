const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Isolated placeholder credentials: no local .env or external services used.
Object.assign(process.env, {
  NODE_ENV: 'production',
  SUPABASE_URL: 'https://deployment-test.supabase.co',
  SUPABASE_KEY: 'public-test-key',
  SUPABASE_SERVICE_KEY: 'private-test-key',
  ALLOWED_ORIGINS: 'https://orbivex-test.vercel.app/',
  RATE_LIMIT_AUTH: '1',
  OPENROUTER_API_KEY: '',
  NVIDIA_API_KEY: '',
  RESEND_API_KEY: '',
});

const app = require('../server');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('health probe needs no database, credentials file or origin', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
  assert.equal(res.headers.get('ratelimit-limit'), null);
});
test('Vercel origin receives CORS headers including download filename access', async () => {
  const res = await fetch(`${base}/healthz`, { headers: { Origin: 'https://orbivex-test.vercel.app' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://orbivex-test.vercel.app');
  assert.equal(res.headers.get('access-control-expose-headers'), 'Content-Disposition');
});
test('Authorization preflight succeeds and other origins are rejected', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'OPTIONS', headers: {
      Origin: 'https://orbivex-test.vercel.app',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('access-control-allow-headers'), /authorization/i);
  const rejected = await fetch(`${base}/healthz`, { headers: { Origin: 'https://other.vercel.app' } });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});
test('authentication throttling separates clients behind Render proxy', async () => {
  async function login(ip) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: '{}',
    });
    await res.text();
    return res.status;
  }
  assert.equal(await login('203.0.113.1'), 400);
  assert.equal(await login('203.0.113.1'), 429);
  assert.equal(await login('203.0.113.2'), 400);
});
test('production fails startup immediately for missing secrets or origins', () => {
  for (const name of ['SUPABASE_SERVICE_KEY', 'ALLOWED_ORIGINS']) {
    const result = spawnSync(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'), env: { ...process.env, [name]: '' }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(name));
  }
});
