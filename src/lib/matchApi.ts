import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

/**
 * Cloudflare Worker Backend API endpoint (Absolute URL only)
 * Do NOT use relative paths like /api/matches (Pages Functions lacks D1 binding)
 */
export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';

export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
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
 * Fetch all matches directly from Cloudflare Worker D1
 * Returns remote matches or throws/returns null so caller knows it failed
 */
export async function fetchAllMatchesFromWorker(): Promise<{ matches: Match[]; error?: string }> {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return { matches: [], error: `서버 응답 오류 (HTTP ${res.status})` };
    }

    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];

    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      // Overwrite local cache with fresh D1 data
      try {
        localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(normalized));
      } catch (storageErr) {
        console.warn('[MatchApi] localStorage save warning:', storageErr);
      }
      return { matches: normalized };
    }

    return { matches: [] };
  } catch (err: any) {
    console.error('[MatchApi] Worker GET fetch error:', err);
    return { matches: [], error: err?.message || '네트워크 연결 오류' };
  }
}

/**
 * Save new match (POST) to Worker
 * Only on success will this return success: true
 */
export async function createMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);

  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { success: false, error: `경기 저장 실패 (HTTP ${res.status}): ${errorText}` };
    }

    const data = await res.json().catch(() => ({}));
    if (data?.success === false) {
      return { success: false, error: data?.error || '경기 저장 실패' };
    }

    return { success: true, match: normalized };
  } catch (err: any) {
    console.error('[MatchApi] Worker POST error:', err);
    return { success: false, error: err?.message || '경기 저장 요청 중 네트워크 오류가 발생했습니다.' };
  }
}

/**
 * Update existing match (PUT) to Worker
 * Only on success will this return success: true
 */
export async function updateMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);

  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { success: false, error: `경기 수정 실패 (HTTP ${res.status}): ${errorText}` };
    }

    const data = await res.json().catch(() => ({}));
    if (data?.success === false) {
      return { success: false, error: data?.error || '경기 수정 실패' };
    }

    return { success: true, match: normalized };
  } catch (err: any) {
    console.error('[MatchApi] Worker PUT error:', err);
    return { success: false, error: err?.message || '경기 수정 요청 중 네트워크 오류가 발생했습니다.' };
  }
}

/**
 * Delete match: DELETE https://riming-gg.janghyck2.workers.dev?id=${match.id}
 * Must receive success: true before frontend deletes from UI/localStorage
 */
export async function deleteMatchOnWorker(id: string): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        id,
        error: `경기 삭제 실패 (HTTP ${res.status}): ${errorText || '서버 오류'}`,
      };
    }

    const data = await res.json().catch(() => ({}));
    if (data?.success === true) {
      return { success: true, id };
    }

    return {
      success: false,
      id,
      error: data?.error || 'D1 데이터베이스에서 삭제 응답을 받지 못했습니다.',
    };
  } catch (err: any) {
    console.error('[MatchApi] Worker DELETE error:', err);
    return {
      success: false,
      id,
      error: err?.message || '삭제 요청 중 네트워크 오류가 발생했습니다.',
    };
  }
}
