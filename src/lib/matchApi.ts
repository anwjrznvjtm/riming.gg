import { Match } from '../types';
import { normalizeMatch } from './matchSchema';

export const WORKER_BASE_URL = 'https://riming-gg.janghyck2.workers.dev';
export const STORAGE_KEY_MATCHES = 'ck_matches';
export const STORAGE_KEY_LEGACY = 'riming_matches';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
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

export async function fetchAllMatchesFromWorker() {
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Worker GET failed:', res.status, text);
      return { matches: [], source: 'worker', error: `Cloudflare ${res.status}: ${text.slice(0,200)}` };
    }
    const data = await res.json();
    const rawList = Array.isArray(data) ? data : data?.matches || data?.data || [];
    if (Array.isArray(rawList)) {
      const normalized = rawList.map((m: any) => normalizeMatch(m));
      try {
        localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(normalized));
      } catch {}
      return { matches: normalized, source: 'worker' };
    }
    return { matches: [], source: 'worker' };
  } catch (err: any) {
    console.error('fetchAllMatches error:', err);
    return { matches: [], source: 'worker', error: err?.message || 'network error' };
  }
}

export async function createMatchOnWorker(match: Match) {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalized) 
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('POST failed:', res.status, text);
      return { success: false, error: `save fail ${res.status}: ${text.slice(0,200)}` };
    }
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (data?.success === false) return { success: false, error: data?.error || 'save fail' };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || 'local only' };
  }
}

export async function updateMatchOnWorker(match: Match) {
  const normalized = normalizeMatch(match);
  try {
    const res = await fetchWithTimeout(WORKER_BASE_URL, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(normalized) 
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('PUT failed:', res.status, text);
      return { success: false, error: `update fail ${res.status}: ${text.slice(0,200)}` };
    }
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (data?.success === false) return { success: false, error: data?.error || 'update fail' };
    return { success: true, match: normalized };
  } catch (err: any) {
    return { success: false, error: err?.message || 'network error' };
  }
}

export async function deleteMatchOnWorker(id: string) {
  try {
    const targetUrl = `${WORKER_BASE_URL}?id=${encodeURIComponent(id)}`;
    const res = await fetchWithTimeout(targetUrl, { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok) {
      console.error('DELETE failed:', res.status, text);
      return { success: false, id, error: `delete fail ${res.status}: ${text.slice(0,200)}` };
    }
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (data?.success === true || res.status === 200) return { success: true, id };
    return { success: false, id, error: data?.error || 'local delete only' };
  } catch (err: any) {
    return { success: false, id, error: err?.message || 'local delete only' };
  }
}

export const fetchAllMatchesFromApi = fetchAllMatchesFromWorker;
export const createMatchOnApi = createMatchOnWorker;
export const updateMatchOnApi = async (match: Match, _all?: Match[]) => updateMatchOnWorker(match);
export const deleteMatchOnApi = async (id: string, _remaining?: Match[]) => deleteMatchOnWorker(id);
