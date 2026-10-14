const { existsSync } = require('node:fs');
const { resolve } = require('node:path');

// Hosting dashboards provide the production environment. Local development
// keeps using the existing repository .env, regardless of the working directory.
if (process.env.NODE_ENV !== 'production') {
  const envFile = resolve(__dirname, '../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

for (const name of ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_KEY']) {
  if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
}

const production = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(value => value.trim().replace(/\/+$/, '')).filter(Boolean);

if (production && !allowedOrigins.length) {
  throw new Error('ALLOWED_ORIGINS must contain your Vercel frontend HTTPS origin in production.');
}
for (const origin of allowedOrigins) {
  const url = new URL(origin);
  if (url.origin !== origin || (production && url.protocol !== 'https:')) {
    throw new Error('ALLOWED_ORIGINS must contain exact origins (no paths or wildcards), using HTTPS in production.');
  }
}
if (!production) {
  allowedOrigins.push(...[5173, 5174, 5175, 3000].map(port => `http://localhost:${port}`));
}

module.exports = { allowedOrigins, production };
