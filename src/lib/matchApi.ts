import { Match } from '../types';
import { normalizeMatch } from './matchSchema';
import { STORAGE_KEY_MATCHES, STORAGE_KEY_BACKUP, getInitialMatches } from '../data/initialMatches';

/**
 * Cloudflare Worker Backend API endpoint
 */
export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const WORKER_API_ENDPOINT = `${WORKER_BASE_URL}/api/matches`;
export const PAGES_API_ENDPOINT = '/api/matches';

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Fetch all matches with Worker API prioritized
 */
export async function fetchAllMatchesFromApi(): Promise<{ matches: Match[]; source: 'worker' | 'pages' | 'cache' }> {
  // 1. First priority: Cloudflare Worker API (https://riming-gg.janghyck2.workers.dev/api/matches)
  try {
    const res = await fetchWithTimeout(WORKER_API_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
      if (Array.isArray(rawList)) {
        const normalized = rawList.map((m: any) => normalizeMatch(m));
        // Update local backup
        try {
          localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
          localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(normalized));
        } catch {}
        return { matches: normalized, source: 'worker' };
      }
    }
  } catch (workerErr) {
    console.warn('[MatchApi] Cloudflare Worker fetch failed or pending, trying Pages /api/matches fallback:', workerErr);
  }

  // 2. Second priority: Local Pages Function (/api/matches)
  try {
    const res = await fetchWithTimeout(PAGES_API_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, 4000);
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
      if (Array.isArray(rawList)) {
        const normalized = rawList.map((m: any) => normalizeMatch(m));
        try {
          localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
          localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(normalized));
        } catch {}
        return { matches: normalized, source: 'pages' };
      }
    }
  } catch (pagesErr) {
    console.warn('[MatchApi] Pages /api/matches fallback also unavailable, using local cache:', pagesErr);
  }

  // 3. Fallback: Local storage cache
  try {
    const cached = localStorage.getItem(STORAGE_KEY_MATCHES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return { matches: parsed.map((m: any) => normalizeMatch(m)), source: 'cache' };
      }
    }
  } catch {}

  return { matches: getInitialMatches(), source: 'cache' };
}

/**
 * Save match (POST) to Worker and Pages
 */
export async function createMatchOnApi(match: Match): Promise<{ success: boolean; match: Match; source?: string }> {
  const normalized = normalizeMatch(match);
  let saved = false;
  let source = 'none';

  // 1. Post to Worker API
  try {
    const res = await fetchWithTimeout(WORKER_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    if (res.ok) {
      saved = true;
      source = 'worker';
      console.log('[MatchApi] Match created on Cloudflare Worker successfully');
    }
  } catch (err) {
    console.warn('[MatchApi] POST to Worker failed:', err);
  }

  // 2. Also try Pages /api/matches if worker was not reachable or as dual-sync
  if (!saved) {
    try {
      const res = await fetchWithTimeout(PAGES_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      }, 4000);
      if (res.ok) {
        saved = true;
        source = 'pages';
        console.log('[MatchApi] Match created on Pages API successfully');
      }
    } catch (err) {
      console.warn('[MatchApi] POST to Pages failed:', err);
    }
  }

  return { success: saved, match: normalized, source };
}

/**
 * Update match (PUT) on Worker and Pages
 */
export async function updateMatchOnApi(match: Match): Promise<{ success: boolean; match: Match; source?: string }> {
  const normalized = normalizeMatch(match);
  let updated = false;
  let source = 'none';

  // 1. Put to Worker API
  try {
    const res = await fetchWithTimeout(WORKER_API_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    if (res.ok) {
      updated = true;
      source = 'worker';
      console.log('[MatchApi] Match updated on Cloudflare Worker successfully');
    }
  } catch (err) {
    console.warn('[MatchApi] PUT to Worker failed:', err);
  }

  // 2. Also try Pages API if needed
  if (!updated) {
    try {
      const res = await fetchWithTimeout(PAGES_API_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      }, 4000);
      if (res.ok) {
        updated = true;
        source = 'pages';
      }
    } catch (err) {
      console.warn('[MatchApi] PUT to Pages failed:', err);
    }
  }

  return { success: updated, match: normalized, source };
}

/**
 * Delete match (DELETE) on Worker and Pages
 */
export async function deleteMatchOnApi(id: string): Promise<{ success: boolean; id: string }> {
  let deleted = false;

  // 1. Delete on Worker API
  try {
    const res = await fetchWithTimeout(`${WORKER_API_ENDPOINT}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      deleted = true;
      console.log('[MatchApi] Match deleted on Cloudflare Worker successfully');
    }
  } catch (err) {
    console.warn('[MatchApi] DELETE on Worker failed:', err);
  }

  // 2. Also try Pages API
  if (!deleted) {
    try {
      const res = await fetchWithTimeout(`${PAGES_API_ENDPOINT}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }, 4000);
      if (res.ok) {
        deleted = true;
      }
    } catch (err) {
      console.warn('[MatchApi] DELETE on Pages failed:', err);
    }
  }

  return { success: deleted, id };
}
