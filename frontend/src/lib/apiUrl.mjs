// Accept the backend origin or its /api URL and use the same base for Axios
// and fetch-based AI streams. Development uses Vite's /api proxy by default.
export function resolveApiUrl(value, { production = false } = {}) {
  const base = value?.trim().replace(/\/+$/, '') || '/api';
  if (base === '/api' && !production) return base;
  let url;
  try { url = new URL(base); } catch {
    throw new Error('VITE_API_URL must be your backend URL, such as https://orbivex-api.onrender.com/api.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || !['', '/', '/api'].includes(url.pathname)) {
    throw new Error('VITE_API_URL must be an HTTP(S) backend origin or /api URL, without credentials, query strings or fragments.');
  }
  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Production VITE_API_URL must use your public backend HTTPS URL.');
  }
  return `${url.origin}/api`;
}
