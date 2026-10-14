const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variable');
  process.exit(1);
}

// Since the RLS hardening migration (2026_08_06), every table in `public` is
// deny-by-default and the service role is the only path to data. Falling back
// to the anon client here — as this file used to do — would leave the whole API
// silently returning empty result sets instead of failing at boot.
if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_KEY. All table access requires the');
  console.error('   service role since RLS is deny-by-default. Refusing to start.');
  process.exit(1);
}

// ── Auth-only client ────────────────────────────────────────────────────────
// The anon key carries no user session server-side, so `auth.uid()` is NULL for
// anything it does. Under deny-by-default RLS every table read/write through it
// returns nothing — the failure mode is empty data, not an error, which is the
// worst kind. Several routes used to do exactly this (quizzes, lessons,
// progress, ai, jobs) and their inserts could only ever have worked against
// wide-open policies.
//
// So this client is fenced to `.auth` only. Reach for a table through it and you
// get a loud throw at the call site instead of a mystery empty array in prod.
const rawAnon = createClient(supabaseUrl, supabaseKey);

const FENCED = ['from', 'rpc', 'storage', 'schema'];

const supabase = new Proxy(rawAnon, {
  get(target, prop, receiver) {
    if (FENCED.includes(prop)) {
      throw new Error(
        `config/supabase: refusing \`supabase.${String(prop)}\` — the anon client ` +
        'has no user session, so RLS denies it. Use `supabaseAdmin` and enforce ' +
        'authorization in middleware (authMiddleware + roleMiddleware) instead.'
      );
    }
    return Reflect.get(target, prop, receiver);
  },
});

// ── Service-role client ─────────────────────────────────────────────────────
// Bypasses RLS. This is the application's data path; every route that uses it
// is responsible for its own authorization checks.
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };
