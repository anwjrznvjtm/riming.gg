// SAFE 버전 - 절대 전체 삭제 안 함!
export default {
  async fetch(request, env, ctx) {
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const db = env.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: 'DB not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // 테이블 생성 (없으면)
    try {
      await db.prepare(`CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER
      )`).run();
    } catch (e) {}

    try {
      // GET
      if (request.method === 'GET') {
        const { results } = await db.prepare('SELECT data FROM matches ORDER BY created_at DESC').all();
        const list = results.map(r => {
          try { return JSON.parse(r.data); } catch { return null; }
        }).filter(Boolean);
        return new Response(JSON.stringify(list), {
          headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }

      // POST - 절대 전체 삭제 안 함! SAFE!
      if (request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body) {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }

        // SAFE DELETE via POST - 1개만 삭제!
        if (body.action === 'delete' && body.id) {
          const id = String(body.id);
          if (!id || id === 'undefined' || id === 'null' || id === '') {
            return new Response(JSON.stringify({ error: 'Invalid id for delete' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }
          await db.prepare('DELETE FROM matches WHERE id = ?').bind(id).run();
          return new Response(JSON.stringify({ success: true, id, message: 'Deleted 1 item SAFE' }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }

        // 배치는 merge만 허용! replace는 금지! (전체 삭제 방지)
        if (body.mode && Array.isArray(body.matches)) {
          if (body.mode === 'replace') {
            // SAFE: replace여도 1개씩 upsert만! 전체 DELETE 안 함!
            // 기존 데이터 유지하면서 덮어쓰기
            for (const m of body.matches) {
              const id = String(m.id || Date.now() + Math.random());
              await db.prepare('INSERT OR REPLACE INTO matches (id, data, created_at) VALUES (?, ?, ?)')
                .bind(id, JSON.stringify({ ...m, id }), Date.now()).run();
            }
            return new Response(JSON.stringify({ success: true, count: body.matches.length, mode: 'safe-replace' }), {
              headers: { 'Content-Type': 'application/json', ...CORS }
            });
          }
          // merge
          for (const m of body.matches) {
            const id = String(m.id || Date.now() + Math.random());
            await db.prepare('INSERT OR REPLACE INTO matches (id, data, created_at) VALUES (?, ?, ?)')
              .bind(id, JSON.stringify({ ...m, id }), Date.now()).run();
          }
          return new Response(JSON.stringify({ success: true, count: body.matches.length }), {
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }

        // 단일 추가
        const id = String(body.id || Date.now());
        await db.prepare('INSERT OR REPLACE INTO matches (id, data, created_at) VALUES (?, ?, ?)')
          .bind(id, JSON.stringify({ ...body, id }), Date.now()).run();
        return new Response(JSON.stringify({ success: true, id }), {
          headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }

      // PUT
      if (request.method === 'PUT') {
        const body = await request.json().catch(() => null);
        if (!body || !body.id) {
          return new Response(JSON.stringify({ error: 'id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
        const id = String(body.id);
        await db.prepare('INSERT OR REPLACE INTO matches (id, data, created_at) VALUES (?, ?, ?)')
          .bind(id, JSON.stringify(body), Date.now()).run();
        return new Response(JSON.stringify({ success: true, id }), {
          headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }

      // DELETE - 1개만! 절대 전체 삭제 안 함!
      if (request.method === 'DELETE') {
        let id = url.searchParams.get('id');
        if (!id) {
          const body = await request.json().catch(() => null);
          if (body) id = body.id;
        }
        if (!id || id === 'undefined' || id === 'null' || id === '') {
          return new Response(JSON.stringify({ error: 'Valid id required - will NOT delete all for safety!' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS }
          });
        }
        await db.prepare('DELETE FROM matches WHERE id = ?').bind(String(id)).run();
        return new Response(JSON.stringify({ success: true, id, message: 'Deleted 1 item SAFE' }), {
          headers: { 'Content-Type': 'application/json', ...CORS }
        });
      }

      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }
  }
};
