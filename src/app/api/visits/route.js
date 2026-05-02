import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/visits?userId=xxx — fetch all visits for a user
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT library_id, visited_at FROM visits WHERE user_id = ${userId}
    `;
    const visits = {};
    rows.forEach((r) => { visits[r.library_id] = r.visited_at; });
    return NextResponse.json({ visits });
  } catch (err) {
    console.error('GET /api/visits error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/visits — toggle a visit
export async function POST(request) {
  try {
    const { userId, libraryId, action } = await request.json();

    if (!userId || !libraryId || !action) {
      return NextResponse.json({ error: 'userId, libraryId, action required' }, { status: 400 });
    }

    const sql = getDb();

    if (action === 'visit') {
      await sql`
        INSERT INTO visits (user_id, library_id, visited_at)
        VALUES (${userId}, ${libraryId}, NOW())
        ON CONFLICT (user_id, library_id) DO NOTHING
      `;
      // Update stats
      await sql`
        INSERT INTO library_stats (library_id, visit_count)
        VALUES (${libraryId}, 1)
        ON CONFLICT (library_id) DO UPDATE SET visit_count = library_stats.visit_count + 1
      `;
      // Update hunter profile
      const countResult = await sql`
        SELECT COUNT(*) as total FROM visits WHERE user_id = ${userId}
      `;
      await sql`
        INSERT INTO hunters (user_id, total_visits, last_visit_at)
        VALUES (${userId}, ${countResult[0].total}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          total_visits = ${countResult[0].total},
          last_visit_at = NOW()
      `;
    } else if (action === 'unvisit') {
      await sql`DELETE FROM visits WHERE user_id = ${userId} AND library_id = ${libraryId}`;
      // Decrement stats
      await sql`
        UPDATE library_stats SET visit_count = GREATEST(visit_count - 1, 0)
        WHERE library_id = ${libraryId}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM visits WHERE user_id = ${userId}
      `;
      await sql`
        UPDATE hunters SET total_visits = ${countResult[0].total} WHERE user_id = ${userId}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/visits error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
