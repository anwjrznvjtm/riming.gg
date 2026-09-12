/**
 * Cloudflare Worker for Riming GG CK Journal (CK 일지)
 * Worker Endpoint: https://riming-gg.janghyck2.workers.dev/
 * 
 * Supported methods & routes:
 * - OPTIONS * : CORS Preflight
 * - GET  /api/matches (or /) : Fetch all registered matches
 * - POST /api/matches (or /) : Save new match (or batch upsert)
 * - PUT  /api/matches (or /) : Update existing match
 * - DELETE /api/matches (or /) : Delete match by query param (?id=...) or body
 * 
 * Cloudflare Bindings:
 * - D1 Database: env.DB (primary persistence)
 * - KV Namespace: env.RIMING_KV (optional fallback)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function safeParseJson(val, fallback = {}) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// In-memory fallback if D1 is not bound yet
let memoryMatchesCache = [];

/**
 * Ensure D1 ck_matches table exists
 */
async function ensureTable(db) {
  if (!db || typeof db.exec !== 'function') return;
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
  } catch (err) {
    console.warn('[Worker] ensureTable warning:', err);
  }
}

function rowToMatch(row) {
  return {
    id: String(row.id),
    date: row.date || new Date().toISOString().slice(0, 10),
    ck_name: row.ck_name || '우리밍 CK',
    match_format: row.match_format || '단판',
    set_number: Number(row.set_number) || 1,
    score: row.score || '1:0',
    winning_team: row.winning_team || 'Red',
    team_a: safeParseJson(row.team_a, {}),
    team_b: safeParseJson(row.team_b, {}),
    team_a_champs: safeParseJson(row.team_a_champs, {}),
    team_b_champs: safeParseJson(row.team_b_champs, {}),
    team_a_kda: safeParseJson(row.team_a_kda, {}),
    team_b_kda: safeParseJson(row.team_b_kda, {}),
    ban_a: safeParseJson(row.ban_a, ['', '', '', '', '']),
    ban_b: safeParseJson(row.ban_b, ['', '', '', '', '']),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const db = env?.DB;
    const kv = env?.RIMING_KV || env?.KV;

    try {
      // 2. GET: List all matches
      if (request.method === 'GET') {
        if (db) {
          await ensureTable(db);
          const queryRes = await db
            .prepare('SELECT * FROM ck_matches ORDER BY date DESC, created_at DESC')
            .all();
          const list = (queryRes?.results || []).map((r) => rowToMatch(r));
          return jsonResponse({
            success: true,
            matches: list,
            total: list.length,
            storage: 'D1',
          });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const list = raw ? JSON.parse(raw) : [];
          return jsonResponse({
            success: true,
            matches: list,
            total: list.length,
            storage: 'KV',
          });
        } else {
          return jsonResponse({
            success: true,
            matches: memoryMatchesCache,
            total: memoryMatchesCache.length,
            storage: 'Memory',
          });
        }
      }

      // 3. POST: Create new match OR batch save
      if (request.method === 'POST') {
        const body = await request.json();
        const nowIso = new Date().toISOString();

        // Check if batch
        if (body?.mode && Array.isArray(body?.matches)) {
          const cleanMatches = body.matches.map((m) => ({
            ...m,
            id: String(m.id || `ck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
            created_at: m.created_at || nowIso,
            updated_at: nowIso,
          }));

          if (db) {
            await ensureTable(db);
            if (body.mode === 'replace') {
              await db.prepare('DELETE FROM ck_matches').run();
            }

            const insertStmt = db.prepare(`
              INSERT OR REPLACE INTO ck_matches (
                id, date, ck_name, match_format, set_number, score, winning_team,
                team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
                ban_a, ban_b, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const batchStatements = cleanMatches.map((m) =>
              insertStmt.bind(
                m.id,
                m.date || nowIso.slice(0, 10),
                m.ck_name || '우리밍 CK',
                m.match_format || '단판',
                Number(m.set_number) || 1,
                m.score || '1:0',
                m.winning_team || 'Red',
                JSON.stringify(m.team_a || {}),
                JSON.stringify(m.team_b || {}),
                JSON.stringify(m.team_a_champs || {}),
                JSON.stringify(m.team_b_champs || {}),
                JSON.stringify(m.team_a_kda || {}),
                JSON.stringify(m.team_b_kda || {}),
                JSON.stringify(m.ban_a || []),
                JSON.stringify(m.ban_b || []),
                m.created_at,
                m.updated_at
              )
            );

            if (batchStatements.length > 0) {
              await db.batch(batchStatements);
            }

            return jsonResponse({
              success: true,
              mode: body.mode,
              count: cleanMatches.length,
              storage: 'D1',
            });
          } else if (kv) {
            await kv.put('ck_matches', JSON.stringify(cleanMatches));
            return jsonResponse({ success: true, count: cleanMatches.length, storage: 'KV' });
          } else {
            memoryMatchesCache = cleanMatches;
            return jsonResponse({ success: true, count: cleanMatches.length, storage: 'Memory' });
          }
        }

        // Single Match Insert
        const m = body?.match || body;
        if (!m || (!m.date && !m.team_a && !m.ck_name)) {
          return jsonResponse({ error: '유효한 경기 데이터가 아닙니다.' }, 400);
        }

        const matchId = String(m.id || `ck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const cleanMatch = {
          id: matchId,
          date: m.date || nowIso.slice(0, 10),
          ck_name: m.ck_name || '우리밍 CK',
          match_format: m.match_format || '단판',
          set_number: Number(m.set_number) || 1,
          score: m.score || '1:0',
          winning_team: m.winning_team || 'Red',
          team_a: m.team_a || {},
          team_b: m.team_b || {},
          team_a_champs: m.team_a_champs || {},
          team_b_champs: m.team_b_champs || {},
          team_a_kda: m.team_a_kda || {},
          team_b_kda: m.team_b_kda || {},
          ban_a: m.ban_a || ['', '', '', '', ''],
          ban_b: m.ban_b || ['', '', '', '', ''],
          created_at: m.created_at || nowIso,
          updated_at: nowIso,
        };

        if (db) {
          await ensureTable(db);
          await db
            .prepare(`
              INSERT OR REPLACE INTO ck_matches (
                id, date, ck_name, match_format, set_number, score, winning_team,
                team_a, team_b, team_a_champs, team_b_champs, team_a_kda, team_b_kda,
                ban_a, ban_b, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              cleanMatch.id,
              cleanMatch.date,
              cleanMatch.ck_name,
              cleanMatch.match_format,
              cleanMatch.set_number,
              cleanMatch.score,
              cleanMatch.winning_team,
              JSON.stringify(cleanMatch.team_a),
              JSON.stringify(cleanMatch.team_b),
              JSON.stringify(cleanMatch.team_a_champs),
              JSON.stringify(cleanMatch.team_b_champs),
              JSON.stringify(cleanMatch.team_a_kda),
              JSON.stringify(cleanMatch.team_b_kda),
              JSON.stringify(cleanMatch.ban_a),
              JSON.stringify(cleanMatch.ban_b),
              cleanMatch.created_at,
              cleanMatch.updated_at
            )
            .run();

          return jsonResponse({
            success: true,
            match: cleanMatch,
            storage: 'D1',
          });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = [cleanMatch, ...currentList.filter((x) => String(x.id) !== cleanMatch.id)];
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, match: cleanMatch, storage: 'KV' });
        } else {
          memoryMatchesCache = [cleanMatch, ...memoryMatchesCache.filter((x) => String(x.id) !== cleanMatch.id)];
          return jsonResponse({ success: true, match: cleanMatch, storage: 'Memory' });
        }
      }

      // 4. PUT: Update existing match
      if (request.method === 'PUT') {
        const body = await request.json();
        const m = body?.match || body;
        if (!m || !m.id) {
          return jsonResponse({ error: '수정할 경기 ID가 필요합니다.' }, 400);
        }

        const nowIso = new Date().toISOString();
        const matchId = String(m.id);
        const cleanMatch = {
          id: matchId,
          date: m.date || nowIso.slice(0, 10),
          ck_name: m.ck_name || '우리밍 CK',
          match_format: m.match_format || '단판',
          set_number: Number(m.set_number) || 1,
          score: m.score || '1:0',
          winning_team: m.winning_team || 'Red',
          team_a: m.team_a || {},
          team_b: m.team_b || {},
          team_a_champs: m.team_a_champs || {},
          team_b_champs: m.team_b_champs || {},
          team_a_kda: m.team_a_kda || {},
          team_b_kda: m.team_b_kda || {},
          ban_a: m.ban_a || ['', '', '', '', ''],
          ban_b: m.ban_b || ['', '', '', '', ''],
          created_at: m.created_at || nowIso,
          updated_at: nowIso,
        };

        if (db) {
          await ensureTable(db);
          await db
            .prepare(`
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
            `)
            .bind(
              cleanMatch.date,
              cleanMatch.ck_name,
              cleanMatch.match_format,
              cleanMatch.set_number,
              cleanMatch.score,
              cleanMatch.winning_team,
              JSON.stringify(cleanMatch.team_a),
              JSON.stringify(cleanMatch.team_b),
              JSON.stringify(cleanMatch.team_a_champs),
              JSON.stringify(cleanMatch.team_b_champs),
              JSON.stringify(cleanMatch.team_a_kda),
              JSON.stringify(cleanMatch.team_b_kda),
              JSON.stringify(cleanMatch.ban_a),
              JSON.stringify(cleanMatch.ban_b),
              cleanMatch.updated_at,
              cleanMatch.id
            )
            .run();

          return jsonResponse({ success: true, match: cleanMatch, storage: 'D1' });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = currentList.map((x) => (String(x.id) === cleanMatch.id ? cleanMatch : x));
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, match: cleanMatch, storage: 'KV' });
        } else {
          memoryMatchesCache = memoryMatchesCache.map((x) =>
            String(x.id) === cleanMatch.id ? cleanMatch : x
          );
          return jsonResponse({ success: true, match: cleanMatch, storage: 'Memory' });
        }
      }

      // 5. DELETE: Delete match
      if (request.method === 'DELETE') {
        let targetId = url.searchParams.get('id');
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = body?.id;
          } catch {}
        }

        if (!targetId) {
          return jsonResponse({ error: '삭제할 경기 ID가 필요합니다.' }, 400);
        }

        const idStr = String(targetId);

        if (db) {
          await ensureTable(db);
          await db.prepare('DELETE FROM ck_matches WHERE id = ?').bind(idStr).run();
          return jsonResponse({ success: true, id: idStr, storage: 'D1' });
        } else if (kv) {
          const raw = await kv.get('ck_matches');
          const currentList = raw ? JSON.parse(raw) : [];
          const updated = currentList.filter((x) => String(x.id) !== idStr);
          await kv.put('ck_matches', JSON.stringify(updated));
          return jsonResponse({ success: true, id: idStr, storage: 'KV' });
        } else {
          memoryMatchesCache = memoryMatchesCache.filter((x) => String(x.id) !== idStr);
          return jsonResponse({ success: true, id: idStr, storage: 'Memory' });
        }
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      console.error('[Worker Error]', err);
      return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500);
    }
  },
};
