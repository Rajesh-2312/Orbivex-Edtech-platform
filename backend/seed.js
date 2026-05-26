/**
 * Seed script — creates sample admin + student accounts.
 * Run: node seed.js
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USERS = [
  {
    email: 'admin@orbivex.com',
    password: 'admin123',
    display_name: 'Admin User',
    role: 'admin',
  },
  {
    email: 'teacher@orbivex.com',
    password: 'teacher123',
    display_name: 'Demo Teacher',
    role: 'teacher',
  },
  {
    email: 'student@orbivex.com',
    password: 'student123',
    display_name: 'Demo Student',
    role: 'student',
  },
];

async function seed() {
  console.log('Seeding users...\n');

  for (const user of USERS) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: user.display_name },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log(`  [skip] ${user.email} — already exists`);

        // Still update role in profiles
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', user.email.split('@')[0])
          .single();

        if (existing) {
          await supabase
            .from('profiles')
            .update({ role: user.role, display_name: user.display_name })
            .eq('id', existing.id);
          console.log(`  [updated] ${user.email} role → ${user.role}`);
        }
        continue;
      }
      console.error(`  [error] ${user.email}: ${authError.message}`);
      continue;
    }

    // Upsert profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        username: user.email.split('@')[0],
        display_name: user.display_name,
        role: user.role,
      });

    if (profileErr) {
      console.error(`  [profile error] ${user.email}: ${profileErr.message}`);
    } else {
      console.log(`  [created] ${user.email} (${user.role}) — password: ${user.password}`);
    }
  }

  console.log('\n--- Sample Credentials ---');
  console.log('Admin:   admin@orbivex.com   / admin123');
  console.log('Teacher: teacher@orbivex.com / teacher123');
  console.log('Student: student@orbivex.com / student123');
  console.log('\nDone!');
}

seed().catch(console.error);
