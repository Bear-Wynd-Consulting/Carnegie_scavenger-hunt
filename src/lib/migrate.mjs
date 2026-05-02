import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: Set DATABASE_URL environment variable first.');
  console.error('  export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Running Carnegie Scavenger Hunt migrations...\n');

  // Visits table — tracks each user's library visits
  await sql`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      library_id INTEGER NOT NULL,
      visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, library_id)
    )
  `;
  console.log('✓ visits table');

  // Index for fast lookups by user
  await sql`
    CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id)
  `;
  console.log('✓ visits index');

  // Global stats table — aggregate counters
  await sql`
    CREATE TABLE IF NOT EXISTS library_stats (
      library_id INTEGER PRIMARY KEY,
      visit_count INTEGER NOT NULL DEFAULT 0
    )
  `;
  console.log('✓ library_stats table');

  // Leaderboard-friendly view of active hunters
  await sql`
    CREATE TABLE IF NOT EXISTS hunters (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      total_visits INTEGER NOT NULL DEFAULT 0,
      last_visit_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✓ hunters table');

  console.log('\nMigration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
