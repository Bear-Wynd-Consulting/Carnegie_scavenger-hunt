import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/stats — global stats and leaderboard
export async function GET() {
  try {
    const sql = getDb();

    // Top visited libraries
    const topLibraries = await sql`
      SELECT library_id, visit_count FROM library_stats
      ORDER BY visit_count DESC LIMIT 10
    `;

    // Leaderboard
    const leaderboard = await sql`
      SELECT user_id, display_name, total_visits, last_visit_at
      FROM hunters
      ORDER BY total_visits DESC
      LIMIT 20
    `;

    // Total unique hunters
    const hunterCount = await sql`
      SELECT COUNT(*) as total FROM hunters WHERE total_visits > 0
    `;

    return NextResponse.json({
      topLibraries,
      leaderboard,
      totalHunters: Number(hunterCount[0]?.total || 0),
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/stats — update display name
export async function POST(request) {
  try {
    const { userId, displayName } = await request.json();
    if (!userId || !displayName) {
      return NextResponse.json({ error: 'userId and displayName required' }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      INSERT INTO hunters (user_id, display_name, total_visits)
      VALUES (${userId}, ${displayName}, 0)
      ON CONFLICT (user_id) DO UPDATE SET display_name = ${displayName}
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/stats error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
