import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchAllMatchesFromWorker(): Promise<{ matches: Match[]; source?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) return { matches: [], source: 'worker', error: `서버 응답 오류 (HTTP ${res.status})` };
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      try {
        localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
        localStorage.setItem(STORAGE_KEY_LEGACY, JSON.stringify(normalized));
      } catch {}
      return { matches: normalized, source: 'worker' };
    }
    return { matches: [], source: 'worker' };
  } catch (err: any) {
    return { matches: [], source: 'worker', error: err?.message || '네트워크 연결 오류' };
  }
}

export async function createMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
    if (!res.ok) return { success: false, error: `경기 저장 실패 (HTTP ${res.status})` };
    const data = await res.json().catch(() => ({}));
    if (data?.success === false) return { success: false, error: data?.error || '경기 저장 실패' };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || '네트워크 오류' };
  }
}

// FIX v8: PUT 실패시 POST로 재시도 (Worker가 PUT을 지원 안 할 때 대비)
// D1은 id 기준 INSERT OR REPLACE 하므로 POST로도 수정 가능
export async function updateMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  
  // 1차 시도: PUT
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.success !== false) {
        console.log('[MatchApi] PUT update success');
        return { success: true, match: normalized };
      }
      console.warn('[MatchApi] PUT returned success:false, trying POST fallback', data);
    } else {
      console.warn(`[MatchApi] PUT failed HTTP ${res.status}, trying POST fallback`);
    }
  } catch (err) {
    console.warn('[MatchApi] PUT error, trying POST fallback', err);
  }

  // 2차 시도: POST로 upsert (대부분의 Worker가 이렇게 구현됨)
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { success: false, error: `수정 실패 - PUT,POST 모두 실패 (HTTP ${res.status}) ${txt}` };
    }
    const data = await res.json().catch(() => ({}));
    if (data?.success === false) {
      return { success: false, error: data?.error || 'POST upsert 실패' };
    }
    console.log('[MatchApi] POST upsert success (update fallback)');
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || '네트워크 오류 (PUT/POST 모두 실패)' };
  }
}

export async function deleteMatchOnWorker(id: string): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, { method: 'DELETE' });
    if (!res.ok) return { success: false, id, error: `경기 삭제 실패 (HTTP ${res.status})` };
    const data = await res.json().catch(() => ({}));
    if (data?.success === true) return { success: true, id };
    return { success: false, id, error: data?.error || '삭제 응답 없음' };
  } catch (err: any) {
    return { success: false, id, error: err?.message || '네트워크 오류' };
  }
}

export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match, _all?: Match[]) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string, _remaining?: Match[]) => deleteMatchOnWorker(id);
export const batchUpdateMatchesOnApi = updateMatchOnWorker;
export const batchUpdateMatchesOnWorker = updateMatchOnWorker;
