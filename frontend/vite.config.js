import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveApiUrl } from './src/lib/apiUrl.mjs';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    resolveApiUrl(env.VITE_API_URL, { production: true });
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_KEY) {
      throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY before building. Use the public anon/publishable key only.');
    }
    if (env.VITE_SUPABASE_KEY.startsWith('sb_secret_')) {
      throw new Error('VITE_SUPABASE_KEY must be a public anon/publishable key, never a secret key.');
    }
    try {
      const claims = JSON.parse(Buffer.from(env.VITE_SUPABASE_KEY.split('.')[1] || '', 'base64url').toString());
      if (claims.role === 'service_role') throw new Error('Do not expose the Supabase service-role key in VITE_SUPABASE_KEY.');
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
