import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, mode: 'cors' });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Cloudflare Only - 로컬스토리지 저장 안 함!
export async function fetchAllMatchesFromWorker(): Promise<{ matches: Match[]; source?: string; error?: string }> {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'GET', 
      headers: { Accept: 'application/json' },
      mode: 'cors'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('GET failed', res.status, text);
      return { matches: [], source: 'worker', error: `HTTP ${res.status}: ${text.slice(0,100)}` };
    }
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      // 로컬스토리지 저장 안 함! - Cloudflare만 사용!
      return { matches: normalized, source: 'worker' };
    }
    return { matches: [], source: 'worker' };
  } catch (err: any) {
    console.error('fetchAll error', err);
    return { matches: [], source: 'worker', error: err?.message || '네트워크 오류' };
  }
}

export async function createMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalized),
      mode: 'cors'
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('POST failed', res.status, text);
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0,100)}` };
    }
    const data = JSON.parse(text || '{}');
    if (data?.success === false) return { success: false, error: data?.error };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function updateMatchOnWorker(match: Match): Promise<{ success: boolean; match?: Match; error?: string }> {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalized),
      mode: 'cors'
    });
    const text = await res.text();
    if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${text.slice(0,100)}` };
    const data = JSON.parse(text || '{}');
    if (data?.success === false) return { success: false, error: data?.error };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function deleteMatchOnWorker(id: string): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    // ?id= + body 둘 다 보내서 Worker가 무조건 인식!
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, { 
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      mode: 'cors'
    });
    const text = await res.text();
    console.log('DELETE response', res.status, text);
    if (!res.ok) return { success: false, id, error: `HTTP ${res.status}: ${text.slice(0,100)}` };
    // Worker가 JSON 안 줘도 200이면 성공으로 처리!
    return { success: true, id };
  } catch (err: any) {
    return { success: false, id, error: err?.message };
  }
}

export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string) => deleteMatchOnWorker(id);
