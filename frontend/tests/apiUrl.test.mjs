import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from '../src/lib/apiUrl.mjs';

test('development uses the Vite API proxy', () => {
  assert.equal(resolveApiUrl(), '/api');
  assert.equal(resolveApiUrl('http://localhost:3001'), 'http://localhost:3001/api');
});
test('backend origin and API URL resolve to the same endpoint', () => {
  for (const value of ['https://app.onrender.com', ' https://app.onrender.com/api/ ']) {
    assert.equal(resolveApiUrl(value, { production: true }), 'https://app.onrender.com/api');
  }
});
test('production rejects missing, local and insecure backend URLs', () => {
  for (const value of [undefined, '/api', 'http://app.onrender.com', 'https://localhost:3001', 'https://127.0.0.1:3001']) {
    assert.throws(() => resolveApiUrl(value, { production: true }));
  }
});
test('rejects URLs that would misroute or embed credentials', () => {
  for (const value of ['https://app.onrender.com/api/api', 'https://app.onrender.com?x=1', 'https://user:pass@app.onrender.com', 'ftp://app.onrender.com']) {
    assert.throws(() => resolveApiUrl(value));
  }
});
