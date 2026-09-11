/**
 * Cloudflare Pages Functions: /api/matches
 * D1 Database Binding: DB
 */

interface Env {
  DB: any; // Cloudflare D1Database binding
}

interface MatchRow {
  id: string;
  date: string;
  ck_name: string;
  match_format: string;
  set_number: number;
  score: string;
  winning_team: string;
  team_a: string; // JSON string
  team_b: string; // JSON string
  team_a_champs: string; // JSON string
  team_b_champs: string; // JSON string
  team_a_kda: string; // JSON string
  team_b_kda: string; // JSON string
  ban_a: string; // JSON string
  ban_b: string; // JSON string
  created_at: string;
  updated_at: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * D1 Table Auto-init helper
 */
async function ensureTable(db: any) {
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ck_matches (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        ck_name TEXT NOT NULL,
        match_format TEXT NOT NULL DEFAULT '단판',
        set_number INTEGER NOT NULL DEFAULT 1,
        score TEXT NOT NULL DEFAULT '1:0',
        winning_team TEXT NOT NULL,
        team_a TEXT NOT NULL,
        team_b TEXT NOT NULL,
        team_a_champs TEXT NOT NULL,
        team_b_champs TEXT NOT NULL,
        team_a_kda TEXT NOT NULL,
        team_b_kda TEXT NOT NULL,
        ban_a TEXT NOT NULL,
        ban_b TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ck_matches_date ON ck_matches(date DESC);
    `);
  } catch (e) {
    console.warn('ensureTable warning:', e);
  }
}

/**
 * Convert D1 Row to Client Match object
 */
function rowToMatch(row: MatchRow): any {
  return {
    id: row.id,
    date: row.date,
    ck_name: row.ck_name,
    match_format: row.match_format || '단판',
    set_number: Number(row.set_number) || 1,
    score: row.score || '1:0',
    winning_team: row.winning_team,
    team_a: safeParseJson(row.team_a, {}),
    team_b: safeParseJson(row.team_b, {}),
    team_a_champs: safeParseJson(row.team_a_champs, {}),
    team_b_champs: safeParseJson(row.team_b_champs, {}),
    team_a_kda: safeParseJson(row.team_a_kda, {}),
    team_b_kda: safeParseJson(row.team_b_kda, {}),
    ban_a: safeParseJson(row.ban_a, []),
    ban_b: safeParseJson(row.ban_b, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function safeParseJson(val: string, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// OPTIONS: Handle CORS preflight
export const onRequestOptions = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

// GET: Fetch all matches from D1
export const onRequestGet = async (context: { env: Env }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ error: 'Cloudflare D1 binding "DB" is not configured.' }, 500);
  }

  try {
    await ensureTable(DB);
    const { results } = await DB.prepare(
      'SELECT * FROM ck_matches ORDER BY date DESC, created_at DESC'
    ).all();

    const matches = (results || []).map((r: any) => rowToMatch(r));
    return jsonResponse({ matches, total: matches.length });
  } catch (err: any) {
    console.error('D1 GET Error:', err);
    return jsonResponse({ error: err?.message || 'Database query error' }, 500);
  }
};

// POST: Create a new match OR batch import
export const onRequestPost = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ error: 'Cloudflare D1 binding "DB" is not configured.' }, 500);
  }

  try {
    await ensureTable(DB);
    const body: any = await context.request.json();

    // Batch Import mode: { mode: 'replace' | 'merge', matches: Match[] }
    if (body.mode && Array.isArray(body.matches)) {
      if (body.mode === 'replace') {
        await DB.prepare('DELETE FROM ck_matches').run();
      }

      const stmt = DB.prepare(`
        INSERT OR REPLACE INTO ck_matches (
          id, date, ck_name, match_format, set_number, score, winning_team,
          team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
          ban_a, ban_b, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const statements = body.matches.map((m: any) =>
        stmt.bind(
          String(m.id || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
          String(m.date || now.slice(0, 10)),
          String(m.ck_name || 'CK 경기'),
          String(m.match_format || '단판'),
          Number(m.set_number) || 1,
          String(m.score || '1:0'),
          String(m.winning_team || 'Red'),
          JSON.stringify(m.team_a || {}),
          JSON.stringify(m.team_b || {}),
          JSON.stringify(m.team_a_champs || {}),
          JSON.stringify(m.team_b_champs || {}),
          JSON.stringify(m.team_a_kda || {}),
          JSON.stringify(m.team_b_kda || {}),
          JSON.stringify(m.ban_a || []),
          JSON.stringify(m.ban_b || []),
          String(m.created_at || now),
          now
        )
      );

      if (statements.length > 0) {
        await DB.batch(statements);
      }

      return jsonResponse({ success: true, count: statements.length });
    }

    // Single Match Insert
    const match = body.match || body;
    const now = new Date().toISOString();
    const id = String(match.id || `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    await DB.prepare(`
      INSERT OR REPLACE INTO ck_matches (
        id, date, ck_name, match_format, set_number, score, winning_team,
        team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
        ban_a, ban_b, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(match.date || now.slice(0, 10)),
      String(match.ck_name || 'CK 경기'),
      String(match.match_format || '단판'),
      Number(match.set_number) || 1,
      String(match.score || '1:0'),
      String(match.winning_team || 'Red'),
      JSON.stringify(match.team_a || {}),
      JSON.stringify(match.team_b || {}),
      JSON.stringify(match.team_a_champs || {}),
      JSON.stringify(match.team_b_champs || {}),
      JSON.stringify(match.team_a_kda || {}),
      JSON.stringify(match.team_b_kda || {}),
      JSON.stringify(match.ban_a || []),
      JSON.stringify(match.ban_b || []),
      String(match.created_at || now),
      now
    ).run();

    return jsonResponse({ success: true, match: { ...match, id } }, 201);
  } catch (err: any) {
    console.error('D1 POST Error:', err);
    return jsonResponse({ error: err?.message || 'Database insert error' }, 500);
  }
};

// PUT: Update an existing match
export const onRequestPut = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ error: 'Cloudflare D1 binding "DB" is not configured.' }, 500);
  }

  try {
    await ensureTable(DB);
    const body: any = await context.request.json();
    const match = body.match || body;
    if (!match.id) {
      return jsonResponse({ error: 'Match id is required for update' }, 400);
    }

    const now = new Date().toISOString();
    await DB.prepare(`
      UPDATE ck_matches SET
        date = ?,
        ck_name = ?,
        match_format = ?,
        set_number = ?,
        score = ?,
        winning_team = ?,
        team_a = ?,
        team_b = ?,
        team_a_champs = ?,
        team_b_champs = ?,
        team_a_kda = ?,
        team_b_kda = ?,
        ban_a = ?,
        ban_b = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      String(match.date),
      String(match.ck_name),
      String(match.match_format || '단판'),
      Number(match.set_number) || 1,
      String(match.score || '1:0'),
      String(match.winning_team),
      JSON.stringify(match.team_a || {}),
      JSON.stringify(match.team_b || {}),
      JSON.stringify(match.team_a_champs || {}),
      JSON.stringify(match.team_b_champs || {}),
      JSON.stringify(match.team_a_kda || {}),
      JSON.stringify(match.team_b_kda || {}),
      JSON.stringify(match.ban_a || []),
      JSON.stringify(match.ban_b || []),
      now,
      String(match.id)
    ).run();

    return jsonResponse({ success: true, match });
  } catch (err: any) {
    console.error('D1 PUT Error:', err);
    return jsonResponse({ error: err?.message || 'Database update error' }, 500);
  }
};

// DELETE: Delete a match by ID
export const onRequestDelete = async (context: { env: Env; request: Request }) => {
  const { DB } = context.env;
  if (!DB) {
    return jsonResponse({ error: 'Cloudflare D1 binding "DB" is not configured.' }, 500);
  }

  try {
    await ensureTable(DB);
    const url = new URL(context.request.url);
    let id = url.searchParams.get('id');

    if (!id) {
      try {
        const body: any = await context.request.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return jsonResponse({ error: 'id query parameter or body is required' }, 400);
    }

    await DB.prepare('DELETE FROM ck_matches WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true, deletedId: id });
  } catch (err: any) {
    console.error('D1 DELETE Error:', err);
    return jsonResponse({ error: err?.message || 'Database delete error' }, 500);
  }
};
