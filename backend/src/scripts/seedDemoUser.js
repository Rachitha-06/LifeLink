/**
 * Seeds the four demo accounts referenced in the README so that
 * "Demo Credentials" actually works against a fresh database.
 *
 * Run with: npm run db:seed  (from backend/)
 *
 * Passwords are hashed here at run time with the same bcrypt cost factor
 * (12) used by the real registration/login flow, rather than committing
 * static password hashes into schema.sql — that way this stays correct
 * even if the bcrypt cost factor ever changes, and nobody has to
 * regenerate a hash by hand.
 *
 * Idempotent: safe to run multiple times, existing rows are left alone.
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// SAFETY GUARD: these passwords are published in README.md. Seeding them
// into a real production database — including an admin and a
// hospital_admin account — would mean anyone who reads the README could
// log in as an admin. Require an explicit opt-in rather than let
// `npm run db:seed` silently do this if NODE_ENV=production.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
  console.error(
    'Refusing to seed demo accounts: NODE_ENV=production.\n' +
    'These passwords are public (see README.md) — seeding them into a real production\n' +
    'database would let anyone log in as an admin.\n' +
    'If you genuinely want demo accounts in this environment, re-run with ALLOW_PROD_SEED=true,\n' +
    'and change these passwords immediately after.'
  );
  process.exit(1);
}

const DEMO_USERS = [
  { name: 'Demo Donor', email: 'donor@lifelink.org', password: 'donor123', role: 'donor', blood_type: 'O+', organ_type: 'Blood', city: 'Bangalore', state: 'Karnataka' },
  { name: 'Demo Patient', email: 'patient@lifelink.org', password: 'recip123', role: 'recipient', blood_type: 'A+', city: 'Bangalore', state: 'Karnataka' },
  { name: 'Demo Hospital Admin', email: 'hospital@lifelink.org', password: 'hosp123', role: 'hospital_admin', city: 'Bangalore', state: 'Karnataka' },
  { name: 'Demo System Admin', email: 'admin@lifelink.org', password: 'admin123', role: 'admin', city: 'Bangalore', state: 'Karnataka' },
];

async function seed() {
  console.log('Seeding demo users...');

  for (const u of DEMO_USERS) {
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [u.email]);
    if (existing.rows.length) {
      console.log(`  skip (already exists): ${u.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, blood_type, organ_type, city, state, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, TRUE)`,
      [u.name, u.email, passwordHash, u.role, u.blood_type || null, u.organ_type || null, u.city, u.state]
    );
    console.log(`  created: ${u.email} (${u.role})`);
  }

  console.log('Done.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
